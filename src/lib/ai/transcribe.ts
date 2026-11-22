/**
 * Speech-to-Text Audio Transcription via Groq Whisper.
 * Converts WhatsApp voice notes / audio messages into text.
 */
export async function transcribeAudio(args: {
  buffer: Buffer
  mimeType?: string | null
  apiKey: string
}): Promise<string | null> {
  try {
    const { buffer, mimeType, apiKey } = args
    if (!buffer || buffer.length === 0 || !apiKey) return null

    // Determine extension
    let ext = 'ogg'
    if (mimeType?.includes('wav')) ext = 'wav'
    else if (mimeType?.includes('mp3')) ext = 'mp3'
    else if (mimeType?.includes('m4a') || mimeType?.includes('mp4')) ext = 'm4a'

    const blob = new Blob([new Uint8Array(buffer)], { type: mimeType || 'audio/ogg' })
    const formData = new FormData()
    formData.append('file', blob, `voice_note.${ext}`)
    formData.append('model', 'whisper-large-v3-turbo')
    formData.append('language', 'hi') // Hindi priority, auto-detects others

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error('[transcribe] Groq Whisper error:', res.status, errText)
      return null
    }

    const data = await res.json()
    const text = typeof data?.text === 'string' ? data.text.trim() : null
    return text || null
  } catch (err) {
    console.error('[transcribe] Failed to transcribe audio:', err)
    return null
  }
}
