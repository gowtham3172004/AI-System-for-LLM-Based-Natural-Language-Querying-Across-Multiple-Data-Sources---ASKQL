
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

    // For now, we'll return a simulated result since we don't have actual query execution
    // In a real implementation, you would:
    // 1. Load the uploaded file from storage
    // 2. Parse it into a temporary database/table
    // 3. Execute the SQL query against it
    // 4. Return the results

    const simulatedResult = [
      { region: 'North', total_sales: 12500 },
      { region: 'South', total_sales: 9800 },
      { region: 'East', total_sales: 15300 },
      { region: 'West', total_sales: 11200 }
    ]

    // Update query history with results
    if (file_id) {
      await supabaseClient
        .from('query_history')
        .update({ result: simulatedResult })
        .eq('user_id', user.id)
        .eq('sql_generated', sql_query)
        .order('timestamp', { ascending: false })
        .limit(1)
    }

    return new Response(JSON.stringify({
      success: true,
      result: simulatedResult,
      row_count: simulatedResult.length
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
