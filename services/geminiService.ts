
import { GoogleGenAI, Type } from "@google/genai";

const getAiClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

async function optimizeImage(base64: string, maxWidth = 1024): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = (maxWidth / width) * height;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
      }
      resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
    };
  });
}

export const analyzeVisualDifferences = async (
  designImageBase64: string,
  devImageBase64: string
): Promise<any[]> => {
  const ai = getAiClient();

  const [cleanDesign, cleanDev] = await Promise.all([
    optimizeImage(designImageBase64),
    optimizeImage(devImageBase64)
  ]);

  const prompt = `
    你是一位顶级的视觉还原走查工程师。请对比“设计稿”与“开发实现图”，进行像素级深度分析。
    
    分析要求：
    1. 必须使用“中文”输出 title、description 和 suggestion。
    2. 检查布局对齐、文字字号、间距和颜色差异。
    3. 给出修复该差异的 CSS 建议。
    4. 准确识别差异区域的坐标 boundingBox [ymin, xmin, ymax, xmax] (0-1000 坐标系)。
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { text: "设计稿（基准）:" },
          { inlineData: { mimeType: "image/jpeg", data: cleanDesign } },
          { text: "开发实现图（待测）:" },
          { inlineData: { mimeType: "image/jpeg", data: cleanDev } },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              suggestion: { type: Type.STRING },
              severity: { type: Type.STRING, enum: ["low", "medium", "high", "critical"] },
              boundingBox: {
                 type: Type.ARRAY,
                 items: { type: Type.NUMBER },
                 description: "[ymin, xmin, ymax, xmax] 0-1000 scale"
              }
            },
            required: ["title", "description", "suggestion", "severity"],
          },
        },
      },
    });

    return response.text ? JSON.parse(response.text) : [];
  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
};
