import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface GenerateSQLRequest {
  question: string;
  schema?: string;
  executeQuery?: boolean;
  mode?: 'general' | 'educational' | 'schema-aware' | 'execute' | 'database';
  tableData?: any[];
  fileName?: string;
  connectionInfo?: any; // For database connections
  isFollowUp?: boolean;
  messageHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
    query?: string;
  }>;
}

// Simple SQL query executor for array data
function executeQueryOnData(sqlQuery: string, data: any[], fileName?: string): any {
  console.log('Executing query:', sqlQuery);
  console.log('Data sample:', data.slice(0, 2));
  
  // Simple query parser for basic SELECT statements
  const query = sqlQuery.toLowerCase().trim();
  
  // Extract table name from filename or use 'data'
  const tableName = fileName ? fileName.replace(/\.(csv|xlsx|xls)$/i, '').toLowerCase() : 'data';
  
  // Basic SELECT query parsing
  if (!query.startsWith('select')) {
    throw new Error('Only SELECT queries are supported');
  }
  
  let result = [...data];
  
  // Parse WHERE clause
  const whereMatch = query.match(/where\s+(.+?)(?:\s+order\s+by|\s+group\s+by|\s+limit|$)/);
  if (whereMatch) {
    const whereClause = whereMatch[1].trim();
    result = result.filter(row => evaluateWhereClause(row, whereClause));
  }
  
  // Parse column selection
  const selectMatch = query.match(/select\s+(.+?)\s+from/);
  if (selectMatch) {
    const columns = selectMatch[1].trim();
    if (columns !== '*') {
      const columnList = columns.split(',').map(col => col.trim().replace(/['"]/g, ''));
      result = result.map(row => {
        const newRow: any = {};
        columnList.forEach(col => {
          // Handle column aliases and find matching keys
          const matchingKey = Object.keys(row).find(key => 
            key.toLowerCase().includes(col.toLowerCase()) || 
            col.toLowerCase().includes(key.toLowerCase())
          );
          if (matchingKey) {
            newRow[matchingKey] = row[matchingKey];
          }
        });
        return newRow;
      });
    }
  }
  
  // Parse ORDER BY
  const orderMatch = query.match(/order\s+by\s+(.+?)(?:\s+limit|$)/);
  if (orderMatch) {
    const orderClause = orderMatch[1].trim();
    const [column, direction = 'asc'] = orderClause.split(/\s+/);
    const matchingKey = Object.keys(data[0] || {}).find(key => 
      key.toLowerCase().includes(column.toLowerCase())
    );
    
    if (matchingKey) {
      result.sort((a, b) => {
        const aVal = a[matchingKey];
        const bVal = b[matchingKey];
        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return direction.toLowerCase() === 'desc' ? -comparison : comparison;
      });
    }
  }
  
  // Parse LIMIT
  const limitMatch = query.match(/limit\s+(\d+)/);
  if (limitMatch) {
    const limit = parseInt(limitMatch[1]);
    result = result.slice(0, limit);
  }
  
  return {
    query: sqlQuery,
    totalRows: result.length,
    data: result.slice(0, 100), // Limit display to 100 rows
    executedAt: new Date().toISOString()
  };
}

// Simple WHERE clause evaluator
function evaluateWhereClause(row: any, whereClause: string): boolean {
  // Handle simple conditions like "column > value", "column = 'value'", etc.
  const conditions = whereClause.split(/\s+and\s+|\s+or\s+/i);
  
  for (const condition of conditions) {
    const match = condition.match(/(\w+)\s*(>=|<=|>|<|=|!=)\s*(.+)/);
    if (match) {
      const [, column, operator, value] = match;
      const cleanValue = value.replace(/['"]/g, '').trim();
      
      // Find matching column key
      const matchingKey = Object.keys(row).find(key => 
        key.toLowerCase().includes(column.toLowerCase())
      );
      
      if (matchingKey) {
        const rowValue = row[matchingKey];
        const numericValue = parseFloat(cleanValue);
        const isNumeric = !isNaN(numericValue);
        
        switch (operator) {
          case '>':
            return isNumeric ? parseFloat(rowValue) > numericValue : rowValue > cleanValue;
          case '<':
            return isNumeric ? parseFloat(rowValue) < numericValue : rowValue < cleanValue;
          case '>=':
            return isNumeric ? parseFloat(rowValue) >= numericValue : rowValue >= cleanValue;
          case '<=':
            return isNumeric ? parseFloat(rowValue) <= numericValue : rowValue <= cleanValue;
          case '=':
            return isNumeric ? parseFloat(rowValue) === numericValue : rowValue.toString().toLowerCase() === cleanValue.toLowerCase();
          case '!=':
            return isNumeric ? parseFloat(rowValue) !== numericValue : rowValue.toString().toLowerCase() !== cleanValue.toLowerCase();
        }
      }
    }
  }
  
  return true; // Default to include row if condition can't be parsed
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      question, 
      schema, 
      executeQuery = false, 
      mode = 'general', 
      tableData, 
      fileName, 
      connectionInfo,
      isFollowUp = false,
      messageHistory = []
    }: GenerateSQLRequest = await req.json();
    
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY') || 'AIzaSyCXi5pVzszxkgyfsUxhaglOncOpisGwS44';
    if (!geminiApiKey) {
      console.error('GEMINI_API_KEY not found in environment variables');
      
      // Mock response for testing when API key is not set
      const mockResponse = {
        success: true,
        response: "Hi! I'm AskQL, your AI SQL assistant. I'm currently in demo mode. To enable full functionality, please configure the GEMINI_API_KEY in your Supabase project settings.",
        sqlQuery: null,
        explanation: "Demo mode: This is a placeholder response. Configure GEMINI_API_KEY in Supabase settings for full functionality.",
        schema: schema || null,
        results: null,
        mode
      };
      
      return new Response(JSON.stringify(mockResponse), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Enhanced system prompt for different modes
    let systemPrompt = `You are AskQL — an intelligent and versatile AI assistant that helps users with SQL queries and data analysis.

### 🎯 Your Capabilities:
1. **General Conversation**: Answer friendly greetings and general questions about SQL/databases
2. **SQL Education**: Provide SQL query examples and explanations for learning
3. **Schema-Aware Queries**: Generate precise queries using connected database/file schemas
4. **Data Analysis**: Execute queries and return actual results from connected data sources

### 🧠 Response Guidelines:

**For General Greetings/Chat:**
- Be friendly and helpful
- If asked about non-SQL topics, politely explain your SQL/database focus
- Examples: "Hi there! I'm AskQL, ready to help with your SQL queries and data questions!"

**For SQL Educational Questions:**
- Provide clear, well-formatted SQL examples
- Include explanations of syntax and concepts
- Use realistic but generic table/column names

**For Schema-Aware Queries:**
- Use ONLY the provided schema/column names
- Never hallucinate table or column names
- Generate precise, executable queries

**For Data Execution:**
- Analyze the question and connected data structure
- Generate the exact query needed
- Return both the query and the actual results

### ✅ Response Formats:

**General Response:**
Just provide a helpful, conversational answer.

**Educational SQL:**
\`\`\`sql
-- Example: {description}
SELECT column_name
FROM table_name
WHERE condition;
\`\`\`
Explanation: {clear explanation}

**Schema-Aware Query:**
\`\`\`sql
-- Query for: {user_question}
SELECT {actual_columns}
FROM {actual_table}
WHERE {actual_conditions};
\`\`\`

**Data Results:**
\`\`\`sql
-- Query executed: {user_question}
{actual_query}
\`\`\`

Results:
{formatted_results}`;

    // Determine the mode and adjust prompt accordingly
    let prompt = '';
    
    // Handle follow-up messages with context
    let contextualPrompt = '';
    if (isFollowUp && messageHistory.length > 0) {
      const contextMessages = messageHistory.slice(-6); // Last 6 messages for context
      const conversationContext = contextMessages.map(msg => 
        `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}${msg.query ? `\nSQL: ${msg.query}` : ''}`
      ).join('\n\n');
      
      contextualPrompt = `\n\n### 🔄 Conversation Context:
${conversationContext}

**Current follow-up question**: "${question}"

Please use the conversation context above to provide a relevant and accurate response to the current question.`;
    }
    
    if (mode === 'execute' && tableData && tableData.length > 0) {
      // Execute mode with actual data
      const sampleData = tableData.slice(0, 3); // Show first few rows as sample
      const columns = Object.keys(tableData[0] || {});
      
      systemPrompt += `\n\n### 🔍 Current Context:
- You have access to actual data from: ${fileName || 'uploaded file'}
- Available columns: ${columns.join(', ')}
- Sample data structure: ${JSON.stringify(sampleData, null, 2)}
- Total rows: ${tableData.length}

**IMPORTANT**: Generate the SQL query AND execute it against this data to provide actual results.`;

      prompt = `User Question: "${question}"
      
Connected Data: ${fileName || 'User uploaded file'}
Columns: ${columns.join(', ')}
Total Records: ${tableData.length}

Please analyze the question, generate the appropriate SQL query, execute it against the provided data, and return both the query and the actual results.${contextualPrompt}`;

    } else if (mode === 'database' && connectionInfo) {
      // Database connection mode
      systemPrompt += `\n\n### 🗄️ Database Connection:
- Database Type: ${connectionInfo.type}
- Database Name: ${connectionInfo.database}
- Connected to: ${connectionInfo.host}
- Available Schema: Use the provided schema strictly`;
      
      prompt = `User Question: "${question}"
      
Database Connection: ${connectionInfo.type} - ${connectionInfo.database}
Schema:
${schema}

Generate a precise SQL query for this ${connectionInfo.type} database. Use only the tables and columns from the provided schema.${contextualPrompt}`;

    } else if (schema) {
      // Schema-aware mode
      systemPrompt += `\n\n### 📋 Database Schema Available:
Use this schema strictly. Do not create or assume any table/column names not listed here.`;
      
      prompt = `User Question: "${question}"

Database Schema:
${schema}

Generate a precise SQL query using only the provided schema. Explain what the query does.${contextualPrompt}`;

    } else if (tableData && tableData.length > 0) {
      // Execute mode with actual data
      const sampleData = tableData.slice(0, 3); // Show first few rows as sample
      const columns = Object.keys(tableData[0] || {});
      
      systemPrompt += `\n\n### 🔍 Current Context:
- You have access to actual data from: ${fileName || 'uploaded file'}
- Available columns: ${columns.join(', ')}
- Sample data structure: ${JSON.stringify(sampleData, null, 2)}
- Total rows: ${tableData.length}

**IMPORTANT**: Generate the SQL query AND execute it against this data to provide actual results.`;

      prompt = `User Question: "${question}"
      
Connected Data: ${fileName || 'User uploaded file'}
Columns: ${columns.join(', ')}
Total Records: ${tableData.length}

Please analyze the question, generate the appropriate SQL query, execute it against the provided data, and return both the query and the actual results.${contextualPrompt}`;

    } else {
      // General or educational mode
      const isGreeting = /^(hi|hello|hey|good morning|good afternoon|good evening)/i.test(question.trim());
      const isSQLQuestion = /\b(sql|query|select|database|table|join|where|group by|order by)\b/i.test(question);
      
      if (isGreeting) {
        prompt = `User said: "${question}"
        
Please respond in a friendly, welcoming way and introduce yourself as AskQL, ready to help with SQL queries and data analysis.${contextualPrompt}`;
      } else if (isSQLQuestion) {
        prompt = `User Question: "${question}"
        
This appears to be an SQL educational question. Provide helpful SQL examples, syntax explanations, or query patterns that address their question. Use realistic but generic table/column names for examples.${contextualPrompt}`;
      } else {
        prompt = `User Question: "${question}"
        
This question seems to be outside the SQL/database domain. Politely explain that you specialize in SQL queries and database analysis, and ask if they have any SQL-related questions instead.${contextualPrompt}`;
      }
    }

    console.log('Sending request to Gemini API...');
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `${systemPrompt}\n\n${prompt}`
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          topK: 1,
          topP: 1,
          maxOutputTokens: 2048,
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Gemini API Error:', error);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Gemini API Response:', JSON.stringify(data, null, 2));
    
    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('No response generated from Gemini API');
    }

    const generatedText = data.candidates[0].content.parts[0].text;
    
    // Extract SQL query from the response if it's wrapped in code blocks
    const sqlMatch = generatedText.match(/```sql\n(.*?)\n```/s);
    const sqlQuery = sqlMatch ? sqlMatch[1] : null;
    
    // Extract explanation (everything outside SQL blocks)
    const explanation = generatedText.replace(/```sql\n.*?\n```/s, '').trim();

    // Execute query against table data if in execute mode
    let queryResults = null;
    if ((mode === 'execute' || mode === 'database') && sqlQuery && (tableData?.length > 0 || connectionInfo)) {
      try {
        if (tableData?.length > 0) {
          queryResults = executeQueryOnData(sqlQuery, tableData, fileName);
        } else if (connectionInfo) {
          // For database connections, return a message indicating database query would be executed
          queryResults = {
            query: sqlQuery,
            message: `This query would be executed against ${connectionInfo.type} database: ${connectionInfo.database}`,
            note: "Database execution is simulated in this demo. In production, this would connect to your actual database."
          };
        }
      } catch (error) {
        console.error('Query execution error:', error);
        // Don't return failed query messages unless specifically requested
        if (mode === 'execute') {
          queryResults = { error: `Query execution failed: ${error.message}` };
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      response: generatedText,
      sqlQuery,
      explanation: explanation || "Here's the response to your question.",
      schema: schema || null,
      results: queryResults,
      mode
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-sql function:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'An unexpected error occurred'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});