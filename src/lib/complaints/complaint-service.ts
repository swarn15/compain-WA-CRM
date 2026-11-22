import { sendTextMessage, sendMediaMessage, sendTemplateMessage } from '@/lib/whatsapp/meta-api'
import { createClient } from '@supabase/supabase-js'
import { loadAiConfig } from '@/lib/ai/config'

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

export async function getAccountDepartments(accountId?: string) {
  if (!accountId) return DEPARTMENTS
  const db = getDb()
  const { data } = await db
    .from('village_departments')
    .select('*')
    .eq('account_id', accountId)

  if (!data || data.length === 0) return DEPARTMENTS

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const map: Record<string, any> = {}
  for (const row of data) {
    map[row.id] = row
  }
  return map
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
  citizenPhone: string,
  accountId?: string
) {
  const depts = await getAccountDepartments(accountId)
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
            rows: Object.values(depts).map((d: any) => ({
              id: d.id,
              title: (d.title || d.name).slice(0, 24),
              description: (d.description || '').slice(0, 72),
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
  const depts = await getAccountDepartments(args.accountId)
  const dept = depts[args.departmentId]
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
  const depts = await getAccountDepartments(args.accountId)
  const dept = depts[args.session.department]
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
  const { data: insertedComplaint } = await db.from('complaints').insert({
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
    forwarded_to_officer: false,
  }).select('id').single()

  // 2. Remove the session so subsequent messages don't loop
  await db
    .from('contact_complaint_sessions')
    .delete()
    .eq('contact_id', args.contactId)

  // 3. Forward Alert to Department Officer
  let forwardedSuccessfully = false

  // 3a. Try pre-approved WhatsApp Utility Template (works 24x7 without prior chat window)
  try {
    await sendTemplateMessage({
      phoneNumberId: args.creds.phoneNumberId,
      accessToken: args.creds.accessToken,
      to: dept.phone,
      templateName: 'panchayat_complaint_alert',
      language: 'hi',
      params: [
        `#${complaintNumber}`,
        dept.name,
        `+${args.citizenPhone}`,
        (args.description || 'फोटो संलग्न की गई है').slice(0, 100),
      ],
    })
    forwardedSuccessfully = true
    console.log(`[complaints] Forwarded template alert #${complaintNumber} to officer ${dept.phone}`)
  } catch (templateErr) {
    console.log(`[complaints] Template alert not available or pending approval:`, (templateErr as Error)?.message)
  }

  // 3b. Also send direct text alert (rich layout, works inside 24-hr window)
  const officerAlertText = `🚨 नई जन शिकायत अलर्ट (ग्राम पंचायत ललितपुर)\n─────────────────────────\n📋 शिकायत क्रमांक: #${complaintNumber}\n🏢 विभाग: ${dept.icon} ${dept.name}\n👤 नागरिक फोन: +${args.citizenPhone} (${args.citizenName || 'नागरिक'})\n📝 विवरण: "${args.description || 'फोटो संलग्न की गई है'}"\n📅 समय: ${timeFormatted}\n─────────────────────────\nकृपया प्राथमिकता के आधार पर संज्ञान लें।`

  try {
    await sendTextMessage({
      phoneNumberId: args.creds.phoneNumberId,
      accessToken: args.creds.accessToken,
      to: dept.phone,
      text: officerAlertText,
    })
    forwardedSuccessfully = true
    console.log(`[complaints] Forwarded text alert #${complaintNumber} to officer ${dept.phone}`)
  } catch (err) {
    console.error(`[complaints] Free-text alert to officer ${dept.phone} failed (outside 24h window):`, (err as Error)?.message)
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
      forwardedSuccessfully = true
      console.log(`[complaints] Forwarded image #${complaintNumber} to officer ${dept.phone}`)
    } catch (err) {
      console.error(`[complaints] Failed to forward image to officer:`, (err as Error)?.message)
    }
  }

  // Update complaint row with real forwarding status
  if (forwardedSuccessfully && insertedComplaint?.id) {
    await db
      .from('complaints')
      .update({ forwarded_to_officer: true })
      .eq('id', insertedComplaint.id)
  }

  // 5. Send confirmation back to citizen
  const citizenConfirmation = `✅ आपकी शिकायत सफलतापूर्वक दर्ज कर ली गई है!\n\n📋 शिकायत संख्या: #${complaintNumber}\n🏢 विभाग: ${dept.icon} ${dept.name}\n\nआपकी शिकायत ${args.mediaUrl ? 'और फोटो ' : ''}संबंधित ${dept.name} अधिकारी (+${dept.phone}) को भेज दी गई है। शीघ्र ही समस्या का समाधान किया जाएगा।\n\n(भविष्य में नई शिकायत के लिए कभी भी 'Hi' या 'शिकायत' लिखकर भेजें)`

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

  // 6. Record messages in CRM conversation so admin can see audit & confirmation in /inbox
  try {
    await db.from('messages').insert([
      {
        conversation_id: args.conversationId,
        sender_type: 'bot',
        content_type: 'text',
        content_text: citizenConfirmation,
        status: 'delivered',
        created_at: new Date().toISOString(),
      },
      {
        conversation_id: args.conversationId,
        sender_type: 'bot',
        content_type: 'text',
        content_text: `📢 [सिस्टम ऑडिट अलर्ट]: शिकायत #${complaintNumber} दर्ज कर संबंधित ${dept.name} अधिकारी (+${dept.phone}) के WhatsApp पर सफलतापूर्वक फॉरवर्ड कर दी गई है।`,
        status: 'delivered',
        created_at: new Date(Date.now() + 1000).toISOString(),
      },
    ])

    await db
      .from('conversations')
      .update({
        last_message_text: `[शिकायत #${complaintNumber}]: ${dept.name}`,
        last_message_at: new Date().toISOString(),
      })
      .eq('id', args.conversationId)
  } catch (dbErr) {
    console.error('[complaints] Failed to record audit in CRM conversation:', dbErr)
  }

  return true
}

/**
 * Smart AI Complaint Intake & Photo Auto-Attachment:
 * 1. If citizen sends a photo and had a complaint filed within the last 15 minutes,
 *    it auto-attaches the photo to that complaint and forwards to the officer.
 * 2. If citizen sends a natural language message describing a civic problem,
 *    it uses Groq AI to classify the department, registers the complaint,
 *    forwards to the officer, and replies with confirmation + invites photo upload.
 */
export async function tryAiComplaintIntake(args: {
  creds: MetaCredentials
  accountId: string
  contactId: string
  conversationId: string
  citizenPhone: string
  citizenName?: string
  text?: string
  mediaUrl?: string | null
  mediaType?: string | null
}): Promise<boolean> {
  const db = getDb()

  // 1. If media (photo) is sent, check for a recent complaint in the last 15 mins without a photo
  if (args.mediaUrl && args.mediaUrl.startsWith('http')) {
    try {
      const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()
      const { data: recent } = await db
        .from('complaints')
        .select('*')
        .eq('account_id', args.accountId)
        .eq('citizen_phone', args.citizenPhone)
        .is('media_url', null)
        .gte('created_at', fifteenMinsAgo)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (recent) {
        // Update complaint with photo
        await db
          .from('complaints')
          .update({
            media_url: args.mediaUrl,
            media_type: args.mediaType || 'image',
            updated_at: new Date().toISOString(),
          })
          .eq('id', recent.id)

        // Forward photo to officer
        await sendMediaMessage({
          phoneNumberId: args.creds.phoneNumberId,
          accessToken: args.creds.accessToken,
          to: recent.officer_phone,
          kind: 'image',
          link: args.mediaUrl,
          caption: `📸 शिकायत #${recent.complaint_number} की फोटो (नागरिक: +${args.citizenPhone})`,
        })

        // Send confirmation to citizen
        await sendTextMessage({
          phoneNumberId: args.creds.phoneNumberId,
          accessToken: args.creds.accessToken,
          to: args.citizenPhone,
          text: `📸 आपकी फोटो प्राप्त हो गई है और इसे शिकायत #${recent.complaint_number} के साथ संबंधित अधिकारी को भेज दिया गया है। धन्यवाद!`,
        })

        return true
      }
    } catch (err) {
      console.error('[complaints] Failed in photo auto-attach:', err)
    }
  }

  // 2. If no text or text is too short, cannot classify
  const text = args.text?.trim()
  if (!text || text.length < 5) return false

  // Don't auto-classify pure greetings
  const lower = text.toLowerCase()
  if (['hi', 'hello', 'hey', 'namaste', 'नमस्ते', 'प्रणाम', 'ram ram', 'राम राम'].includes(lower)) {
    return false
  }

  // 3. Load AI config
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let aiConfig: any = null
  try {
    aiConfig = await loadAiConfig(db, args.accountId)
  } catch (err) {
    console.error('[complaints] Failed to load AI config:', err)
  }
  if (!aiConfig || !aiConfig.apiKey) return false

  const baseUrl = aiConfig.baseUrl
    ? aiConfig.baseUrl.replace(/\/+$/, '')
    : 'https://api.groq.com/openai/v1'
  const endpoint = `${baseUrl}/chat/completions`

  try {
    const aiRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aiConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: aiConfig.model || 'openai/gpt-oss-120b',
        messages: [
          {
            role: 'system',
            content: `You are an AI civic classifier for Gram Panchayat Lalitpur.
Analyze the user message to determine if it is reporting a civic issue/problem.
Allowed departments:
- dept_water: drinking water, handpumps, pipeline leakage, well, tank, water supply
- dept_electricity: light outage, fallen wire/pole, transformer, street lights
- dept_road: broken road, potholes, drain/drainage blockage, road construction
- dept_clean: garbage dumps, uncleaned streets, foul smell, sanitation

If it is a civic problem/complaint, return JSON:
{
  "is_complaint": true,
  "department": "dept_water" | "dept_electricity" | "dept_road" | "dept_clean",
  "summary": "1-sentence summary of the issue in clean Hindi"
}
If it is a general inquiry, scheme info, question, or greeting, return:
{
  "is_complaint": false
}
Return ONLY valid JSON.`,
          },
          { role: 'user', content: text },
        ],
        temperature: 0.1,
      }),
    })

    if (!aiRes.ok) {
      console.error('[complaints] AI classification HTTP error:', aiRes.status)
      return false
    }

    const aiData = await aiRes.json()
    const rawContent = aiData?.choices?.[0]?.message?.content?.trim()
    if (!rawContent) return false

    // Parse JSON safely
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let parsed: any = null
    try {
      const cleaned = rawContent.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim()
      parsed = JSON.parse(cleaned)
    } catch {
      console.log('[complaints] Failed to parse AI JSON:', rawContent)
      return false
    }

    if (!parsed || !parsed.is_complaint || !parsed.department) {
      return false
    }

    const depts = await getAccountDepartments(args.accountId)
    const dept = depts[parsed.department]
    if (!dept) return false

    // AI confirmed civic complaint! Process and forward immediately!
    await processAndForwardComplaint({
      creds: args.creds,
      accountId: args.accountId,
      contactId: args.contactId,
      conversationId: args.conversationId,
      citizenPhone: args.citizenPhone,
      citizenName: args.citizenName,
      description: parsed.summary ? `${parsed.summary} (नागरिक संदेश: "${text}")` : text,
      mediaUrl: args.mediaUrl,
      mediaType: args.mediaType,
      session: {
        department: dept.id,
        department_label: dept.name,
      },
    })

    console.log(`[complaints] AI successfully recognized and forwarded complaint to ${dept.name}`)
    return true
  } catch (err) {
    console.error('[complaints] Error in tryAiComplaintIntake:', err)
    return false
  }
}
