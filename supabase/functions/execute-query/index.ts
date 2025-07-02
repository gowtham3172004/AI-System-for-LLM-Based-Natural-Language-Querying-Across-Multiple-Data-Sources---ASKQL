
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

    const { sql_query, file_id } = await req.json()

    if (!sql_query) {
      return new Response(JSON.stringify({ error: 'SQL query is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!file_id) {
      return new Response(JSON.stringify({ error: 'File ID is required for query execution' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get file information
    const { data: fileData, error: fileError } = await supabaseClient
      .from('uploaded_files')
      .select('*')
      .eq('id', file_id)
      .eq('user_id', user.id)
      .single()

    if (fileError || !fileData) {
      return new Response(JSON.stringify({ error: 'File not found or access denied' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Download file from storage
    const { data: fileContent, error: downloadError } = await supabaseClient.storage
      .from('uploads')
      .download(fileData.storage_path)

    if (downloadError) {
      return new Response(JSON.stringify({ error: 'Failed to download file' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Parse CSV content
    const csvText = await fileContent.text()
    const lines = csvText.split('\n').filter(line => line.trim())
    
    if (lines.length === 0) {
      return new Response(JSON.stringify({ error: 'File appears to be empty' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Parse headers and data
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
    const rows = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''))
      const row: any = {}
      headers.forEach((header, index) => {
        row[header] = values[index] || ''
      })
      return row
    })

    // Simple SQL execution simulation (basic SELECT support)
    let result = rows

    // Basic WHERE clause support
    if (sql_query.toLowerCase().includes('where')) {
      const whereMatch = sql_query.match(/where\s+(.+?)(?:\s+order\s+by|\s+limit|$)/i)
      if (whereMatch) {
        const condition = whereMatch[1].trim()
        // Very basic condition parsing (column = 'value' or column > number)
        const conditionMatch = condition.match(/(\w+)\s*(=|>|<|>=|<=)\s*['"]?([^'"]+)['"]?/i)
        if (conditionMatch) {
          const [, column, operator, value] = conditionMatch
          result = rows.filter(row => {
            const cellValue = row[column]
            const numValue = parseFloat(value)
            const cellNumValue = parseFloat(cellValue)
            
            switch (operator) {
              case '=':
                return cellValue === value
              case '>':
                return !isNaN(cellNumValue) && !isNaN(numValue) && cellNumValue > numValue
              case '<':
                return !isNaN(cellNumValue) && !isNaN(numValue) && cellNumValue < numValue
              case '>=':
                return !isNaN(cellNumValue) && !isNaN(numValue) && cellNumValue >= numValue
              case '<=':
                return !isNaN(cellNumValue) && !isNaN(numValue) && cellNumValue <= numValue
              default:
                return true
            }
          })
        }
      }
    }

    // Basic LIMIT support
    const limitMatch = sql_query.match(/limit\s+(\d+)/i)
    if (limitMatch) {
      const limit = parseInt(limitMatch[1])
      result = result.slice(0, limit)
    }

    // Update query history with results
    await supabaseClient
      .from('query_history')
      .update({ result: result })
      .eq('user_id', user.id)
      .eq('sql_generated', sql_query)
      .order('timestamp', { ascending: false })
      .limit(1)

    return new Response(JSON.stringify({
      success: true,
      result: result,
      row_count: result.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Query execution error:', error)
    return new Response(JSON.stringify({ 
      error: error.message || 'Query execution failed' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
