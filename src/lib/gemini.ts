import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface SummaryResult {
  title: string;
  author: string;
  category: string;
  documentType: "Book" | "Textbook" | "Academic Paper" | "Article";
  tags: string[];
  thesis: string;
  keyArguments: string[];
  thematicSynthesis: string;
}

export const MODELS = [
  { id: "gemini-3.1-flash-lite-preview", name: "Gemini 3.1 Flash Lite" },
  { id: "gemini-3-flash-preview", name: "Gemini 3 Flash" },
  { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro" },
];

export async function summarizePDF(
  fileBase64: string,
  modelId: string = "gemini-3.1-flash-lite-preview"
): Promise<SummaryResult> {
  const result = await ai.models.generateContent({
    model: modelId,
    contents: [
      {
        parts: [
          {
            text: `You are an expert polymath and research assistant. Analyze the provided PDF—which may be a book, textbook, academic paper, or technical article—and extract a structured scholarly synthesis.
            
            Return the response in JSON format matching this schema:
            {
              "title": "Main title of the work",
              "author": "Primary author(s) or 'Unknown'",
              "category": "Broad academic or thematic category (e.g., Neuroscience, Economics, Modern History)",
              "documentType": "One of: Book, Textbook, Academic Paper, Article",
              "tags": ["Tag1", "Tag2", "Tag3"],
              "thesis": "The core thesis, research question, or overarching message (max 200 words)",
              "keyArguments": ["Key Point 1", "Key Point 2", "Key Point 3", "Key Point 4", "Key Point 5"],
              "thematicSynthesis": "A deep thematic synthesis grounded strictly in the document's unique themes, findings, and the 'soul' of the intellectual contribution."
            }
            
            Identify the document type accurately and adjust your synthesis depth accordingly.`,
          },
          {
            inlineData: {
              mimeType: "application/pdf",
              data: fileBase64,
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          author: { type: Type.STRING },
          category: { type: Type.STRING },
          documentType: { 
            type: Type.STRING, 
            enum: ["Book", "Textbook", "Academic Paper", "Article"] 
          },
          tags: { type: Type.ARRAY, items: { type: Type.STRING } },
          thesis: { type: Type.STRING },
          keyArguments: { type: Type.ARRAY, items: { type: Type.STRING } },
          thematicSynthesis: { type: Type.STRING },
        },
        required: ["title", "author", "category", "documentType", "tags", "thesis", "keyArguments", "thematicSynthesis"],
      },
    },
  });

  try {
    const text = result.text;
    if (!text) throw new Error("No response from AI");
    return JSON.parse(text) as SummaryResult;
  } catch (error) {
    console.error("Failed to parse AI response:", error);
    throw new Error("Could not process the PDF summary. The AI returned an invalid format.");
  }
}
