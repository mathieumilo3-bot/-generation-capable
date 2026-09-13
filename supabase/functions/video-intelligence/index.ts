import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const json = (body: unknown, status=200) => new Response(JSON.stringify(body), {status, headers:{...cors,"Content-Type":"application/json"}});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", {headers:cors});
  if (req.method !== "POST") return json({ok:false,error:"Method not allowed"},405);
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) return json({ok:false,error:"OPENAI_API_KEY manquante dans Supabase."},503);
  try {
    const body = await req.json();
    const prompt = String(body.prompt || "");
    const transcript = String(body.transcript || "");
    const frames = Array.isArray(body.frames) ? body.frames.slice(0,12) : [];
    if (!prompt && !transcript && frames.length===0) return json({ok:false,error:"Aucune donnée d’analyse."},400);
    const content:any[] = [{type:"input_text",text:`Tu es le directeur créatif et commercial de Génération Capable. Analyse une vidéo courte comme un coach de performance, pas comme un générateur de compliments. Objectif: aider l’utilisateur à tourner la prochaine vidéo et à améliorer son funnel STOP → HOLD → TRUST → WANT → ACT. Donne des scores honnêtes /100: hook, clarté, rétention, preuve/confiance, différenciation, conversion. Puis: 1) verdict brutal en 2 phrases, 2) 3 problèmes prioritaires classés par impact, 3) 3 corrections concrètes à tourner, 4) 3 variantes de hooks, 5) un script de 20-40 secondes, 6) shot list seconde par seconde, 7) CTA adapté à l’objectif, 8) une expérience A/B avec UNE seule variable, 9) ce qu’il faut mesurer après publication. Ne prétends jamais connaître la viralité. Sépare observation visuelle, transcription et hypothèse. Contexte: ${prompt}\nTranscription: ${transcript}` }];
    for (const f of frames) if (typeof f === "string" && f.startsWith("data:image/")) content.push({type:"input_image",image_url:f,detail:"low"});
    const r = await fetch("https://api.openai.com/v1/responses", {method:"POST",headers:{"Authorization":`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-5.6-luna",input:[{role:"user",content}],text:{format:{type:"json_schema",name:"video_coach",strict:true,schema:{type:"object",properties:{scores:{type:"object",properties:{hook:{type:"number"},clarity:{type:"number"},retention:{type:"number"},trust:{type:"number"},differentiation:{type:"number"},conversion:{type:"number"},overall:{type:"number"}},required:["hook","clarity","retention","trust","differentiation","conversion","overall"],additionalProperties:false},verdict:{type:"string"},problems:{type:"array",items:{type:"string"}},corrections:{type:"array",items:{type:"string"}},hooks:{type:"array",items:{type:"string"}},script:{type:"string"},shot_list:{type:"array",items:{type:"string"}},cta:{type:"string"},ab_test:{type:"string"},metrics:{type:"array",items:{type:"string"}},evidence_notes:{type:"array",items:{type:"string"}}},required:["scores","verdict","problems","corrections","hooks","script","shot_list","cta","ab_test","metrics","evidence_notes"],additionalProperties:false}}}})});
    const data = await r.json();
    if (!r.ok) return json({ok:false,error:data?.error?.message || "Erreur OpenAI"},502);
    const text = data.output?.find((x:any)=>x.type==="message")?.content?.find((x:any)=>x.type==="output_text")?.text;
    if (!text) return json({ok:false,error:"Réponse IA vide."},502);
    return json({ok:true,analysis:JSON.parse(text)});
  } catch (e) { return json({ok:false,error:e instanceof Error?e.message:String(e)},500); }
});