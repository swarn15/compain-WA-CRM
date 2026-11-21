import { sendTextMessage, sendMediaMessage } from '@/lib/whatsapp/meta-api'
import { createClient } from '@supabase/supabase-js'

export const DEPARTMENTS: Record<
  string,
  {
    id: string
    name: string
    icon: string
    phone: string
    title: string
    description: string
  }
> = {
  dept_water: {
    id: 'dept_water',
    name: 'पेयजल (पानी)',
    icon: '💧',
    phone: '919452600081',
    title: '💧 पेयजल / पानी समस्या',
    description: 'हैंडपंप, नल, टंकी, पाइपलाइन लीकेज',
  },
  dept_electricity: {
    id: 'dept_electricity',
    name: 'बिजली / स्ट्रीट लाइट',
    icon: '💡',
    phone: '919005600081',
    title: '💡 बिजली / स्ट्रीट लाइट',
    description: 'लाइट नहीं आना, खंभा, ट्रांसफार्मर',
  },
  dept_road: {
    id: 'dept_road',
    name: 'सड़क / नाली मरम्मत',
    icon: '🛣️',
    phone: '918318928330',
    title: '🛣️ सड़क / नाली समस्या',
    description: 'टूटी सड़क, गड्ढे, चोक नाली',
  },
  dept_clean: {
    id: 'dept_clean',
    name: 'ग्राम सफाई व स्वच्छता',
    icon: '🧹',
    phone: '918957739959',
    title: '🧹 ग्राम सफाई व स्वच्छता',
    description: 'कचरा ढेर, गंदगी, नाबदान',
  },
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _adminClient: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getDb(): any {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _adminClient
}

interface MetaCredentials {
  phoneNumberId: string
  accessToken: string
}

/**
 * Sends the interactive department list menu to the citizen.
 */
export async function sendDepartmentListMenu(
  creds: MetaCredentials,
  citizenPhone: string
) {
  const url = `https://graph.facebook.com/v21.0/${creds.phoneNumberId}/messages`
  const body = {
    messaging_product: 'whatsapp',
    to: citizenPhone,
    type: 'interactive',
    interactive: {
      type: 'list',
      header: {
        type: 'text',
        text: 'ललितपुर ग्राम पंचायत',
      },
      body: {
        text: 'कृपया अपनी शिकायत का संबंधित विभाग चुनें:',
      },
      footer: {
        text: 'जन शिकायत निवारण सेवा',
      },
      action: {
        button: 'विभाग चुनें ▾',
        sections: [
          {
            title: 'ग्राम पंचायत विभाग',
            rows: Object.values(DEPARTMENTS).map((d) => ({
              id: d.id,
              title: d.title.slice(0, 24),
              description: d.description.slice(0, 72),
            })),
          },
        ],
      },
    },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${creds.accessToken}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    console.error('[complaints] Failed to send department list:', err)
  }
}

/**
 * Handles when a citizen selects a department from the list.
 */
export async function handleDepartmentSelection(args: {
  creds: MetaCredentials
  accountId: string
  contactId: string
  citizenPhone: string
  departmentId: string
}) {
  const dept = DEPARTMENTS[args.departmentId]
  if (!dept) return false

  const db = getDb()

  // Upsert active complaint session for this citizen
  await db.from('contact_complaint_sessions').upsert(
    {
      account_id: args.accountId,
      contact_id: args.contactId,
      department: dept.id,
      department_label: dept.name,
      created_at: new Date().toISOString(),
    },
    { onConflict: 'contact_id' }
  )

  // Send instructions to citizen to provide details and/or photo
  const message = `आपने '${dept.icon} ${dept.name}' विभाग चुना है।\n\nकृपया अपनी शिकायत का पूरा विवरण और अपना वार्ड नंबर/मोहल्ला लिखकर भेजें।\n\n📸 यदि समस्या की फोटो है, तो कृपया फोटो भी खींचकर भेजें।`

  await sendTextMessage({
    phoneNumberId: args.creds.phoneNumberId,
    accessToken: args.creds.accessToken,
    to: args.citizenPhone,
    text: message,
  })

  return true
}

/**
 * Checks if a citizen has an active complaint session in progress.
 */
export async function getActiveComplaintSession(contactId: string) {
  const db = getDb()
  const { data } = await db
    .from('contact_complaint_sessions')
    .select('*')
    .eq('contact_id', contactId)
    .maybeSingle()

  return data
}

/**
 * Completes the complaint submission, forwards text + image to the officer, and confirms to citizen.
 */
export async function processAndForwardComplaint(args: {
  creds: MetaCredentials
  accountId: string
  contactId: string
  conversationId: string
  citizenPhone: string
  citizenName?: string | null
  description?: string | null
  mediaUrl?: string | null
  mediaType?: string | null
  session: {
    department: string
    department_label: string
  }
}) {
  const dept = DEPARTMENTS[args.session.department]
  if (!dept) return false

  const db = getDb()

  // Generate Complaint Number
  const randomSuffix = Math.floor(1000 + Math.random() * 9000)
  const complaintNumber = `LP-${randomSuffix}`
  const now = new Date()
  const timeFormatted = now.toLocaleString('hi-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  // 1. Save complaint record in DB
  await db.from('complaints').insert({
    account_id: args.accountId,
    contact_id: args.contactId,
    conversation_id: args.conversationId,
    complaint_number: complaintNumber,
    department: dept.id,
    department_label: dept.name,
    officer_phone: dept.phone,
    citizen_phone: args.citizenPhone,
    citizen_name: args.citizenName || 'नागरिक',
    description: args.description || (args.mediaUrl ? 'फोटो संलग्न की गई है' : ''),
    media_url: args.mediaUrl,
    media_type: args.mediaType,
    status: 'open',
    forwarded_to_officer: true,
  })

  // 2. Remove the session so subsequent messages don't loop
  await db
    .from('contact_complaint_sessions')
    .delete()
    .eq('contact_id', args.contactId)

  // 3. Forward Alert to Department Officer
  const officerAlertText = `🚨 नई जन शिकायत अलर्ट (ग्राम पंचायत ललितपुर)\n─────────────────────────\n📋 शिकायत क्रमांक: #${complaintNumber}\n🏢 विभाग: ${dept.icon} ${dept.name}\n👤 नागरिक फोन: +${args.citizenPhone} (${args.citizenName || 'नागरिक'})\n📝 विवरण: "${args.description || 'फोटो संलग्न की गई है'}"\n📅 समय: ${timeFormatted}\n─────────────────────────\nकृपया प्राथमिकता के आधार पर संज्ञान लें।`

  try {
    await sendTextMessage({
      phoneNumberId: args.creds.phoneNumberId,
      accessToken: args.creds.accessToken,
      to: dept.phone,
      text: officerAlertText,
    })
    console.log(`[complaints] Forwarded text alert #${complaintNumber} to officer ${dept.phone}`)
  } catch (err) {
    console.error(`[complaints] Failed to send text alert to officer ${dept.phone}:`, err)
  }

  // 4. If image exists, forward image to officer with caption
  if (args.mediaUrl && args.mediaUrl.startsWith('http')) {
    try {
      await sendMediaMessage({
        phoneNumberId: args.creds.phoneNumberId,
        accessToken: args.creds.accessToken,
        to: dept.phone,
        kind: 'image',
        link: args.mediaUrl,
        caption: `📸 शिकायत #${complaintNumber} की फोटो (नागरिक: +${args.citizenPhone})`,
      })
      console.log(`[complaints] Forwarded image #${complaintNumber} to officer ${dept.phone}`)
    } catch (err) {
      console.error(`[complaints] Failed to forward image to officer:`, err)
    }
  }

  // 5. Send confirmation back to citizen
  const citizenConfirmation = `✅ आपकी शिकायत सफलतापूर्वक दर्ज कर ली गई है!\n\n📋 शिकायत संख्या: #${complaintNumber}\n🏢 विभाग: ${dept.icon} ${dept.name}\n\nआपकी शिकायत ${args.mediaUrl ? 'और फोटो ' : ''}संबंधित अधिकारी को भेज दी गई है। शीघ्र ही समस्या का समाधान किया जाएगा।\n\n(भविष्य में नई शिकायत के लिए कभी भी 'Hi' या 'शिकायत' लिखकर भेजें)`

  try {
    await sendTextMessage({
      phoneNumberId: args.creds.phoneNumberId,
      accessToken: args.creds.accessToken,
      to: args.citizenPhone,
      text: citizenConfirmation,
    })
  } catch (err) {
    console.error('[complaints] Failed to send confirmation to citizen:', err)
  }

  return true
}
