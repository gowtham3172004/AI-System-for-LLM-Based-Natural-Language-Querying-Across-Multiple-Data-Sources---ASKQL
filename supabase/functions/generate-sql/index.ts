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
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { question, schema, executeQuery = false }: GenerateSQLRequest = await req.json();
    
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY not found in environment variables');
    }

    // System prompt from user requirements
    const systemPrompt = `You are AskQL — an intelligent and safe AI assistant that translates natural language questions into accurate SQL queries and can return queried data if a data source is connected.

### 🎯 Your Purpose:
Help users interact with structured data (like databases, CSV, or Excel files) using natural language. You will generate SQL queries based on user questions, or if requested, directly return the query result using the connected data source.

### 🧠 Key Behaviors:
1. Generate clean, correct, and optimized SQL queries.
2. Use the provided schema if available.
3. Handle multiple table joins, filters, aggregates, and conditions.
4. Avoid hallucinating table or column names — use schema info if available.
5. Always prefer standard SQL syntax (PostgreSQL-flavored if unsure).
6. Format queries with indentation and readable structure.

### 💡 When Schema Is Provided:
- Use it strictly.
- Never guess or create column/table names not listed in the schema.

### 🧾 When Data Is Connected:
- Assume the backend will execute the query you return.
- Return only valid SQL or requested results.

### 🗃️ If the user uploads a file or connects a database:
- Expect table and column names to be based on schema extraction.
- If user asks questions about the data (e.g., "show me the students with marks > 80"), generate the correct SQL query to fetch the results.

### 🧪 When asked to "run", "execute", or "get answer":
- Return the SQL AND provide an explanation if needed.
- Allow the backend to execute the query and return result data.

### ✅ Format of Your Output:
If user only asks for SQL:
\`\`\`sql
-- SQL for question: {user_question}
SELECT ...
FROM ...
WHERE ...
\`\`\`

When generating SQL, focus on correctness and clarity. Always provide a brief explanation of what the query does.`;

    let prompt = `User Question: "${question}"`;
    
    if (schema) {
      prompt += `\n\nDatabase Schema:\n${schema}`;
    }
    
    if (executeQuery) {
      prompt += `\n\nPlease generate the SQL query and explain what it does.`;
    } else {
      prompt += `\n\nPlease generate only the SQL query for this question.`;
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

    return new Response(JSON.stringify({
      success: true,
      response: generatedText,
      sqlQuery,
      explanation: explanation || "Here's the SQL query for your question.",
      schema: schema || null
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