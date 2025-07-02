
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Verify user authentication
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Generate unique filename
    const timestamp = Date.now()
    const fileName = `${user.id}/${timestamp}_${file.name}`

    // Upload file to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from('uploads')
      .upload(fileName, file)

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`)
    }

    // Parse file content to extract schema
    const fileContent = await file.text()
    let schema = {}

    if (file.name.endsWith('.csv')) {
      // Parse CSV header to get column names
      const lines = fileContent.split('\n')
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
      
      schema = {
        table_name: file.name.replace('.csv', ''),
        columns: headers.map(header => ({
          name: header,
          type: 'TEXT' // Default type for CSV
        }))
      }
    }

    // Save file metadata to database
    const { data: fileRecord, error: dbError } = await supabaseClient
      .from('uploaded_files')
      .insert({
        user_id: user.id,
        filename: file.name,
        schema: schema,
        storage_path: uploadData.path,
      })
      .select()
      .single()

    if (dbError) {
      throw new Error(`Database error: ${dbError.message}`)
    }

    return new Response(JSON.stringify({
      success: true,
      file_id: fileRecord.id,
      filename: file.name,
      schema: schema,
      message: 'File uploaded successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Upload error:', error)
    return new Response(JSON.stringify({ 
      error: error.message || 'Upload failed' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
