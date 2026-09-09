/**
 * Vision and Natural Language AI Analysis for Meals, Photos, and Nutrition Labels.
 * Specialized for Global and Indian Diet & Meals (North, South, East, West Indian cuisine).
 * Supports:
 * 1. Natural language meal description logger (Gemini, Claude, and extensive offline heuristics)
 * 2. Photo meal AI analysis
 * 3. Nutrition label scanner
 */

const FOOD_PHOTO_PROMPT = `You are a professional nutrition estimation assistant specializing in global and Indian cuisine. Look at this photo of a meal or food item and estimate its complete macronutrient and key micronutrient profile based on visible portion size and typical preparation (including ghee, oil, tadka, dal, rice, roti, sabzi). Respond with ONLY a JSON object, no markdown fences, no commentary, in exactly this shape:
{"name": string (short description, e.g. "Chicken thali with rice and dal"), "servingLabel": string (e.g. "1 plate", "~350g"), "calories": number, "protein": number, "carbs": number, "fat": number, "fiber": number, "sugar": number, "sodium": number, "potassium": number, "calcium": number, "iron": number, "vitaminC": number, "confidence": "low"|"medium"|"high", "notes": string (one short sentence about estimation uncertainty)}
If multiple foods are visible, combine them into a single aggregate estimate for the whole plate. Numbers are grams for protein/carbs/fat/fiber/sugar, mg for sodium/potassium/calcium/iron/vitaminC, and kcal for calories. Provide reasonable non-zero estimates for fiber, sodium, potassium, calcium, iron, and vitamin C based on the visible ingredients.`;

const LABEL_PHOTO_PROMPT = `You are a nutrition-label reading assistant. Look at this photo of a packaged food's nutrition facts panel and/or ingredients list. Extract the nutrition per serving and give a plain-language health verdict. Respond with ONLY a JSON object, no markdown fences, no commentary, in exactly this shape:
{"productName": string, "servingLabel": string, "calories": number, "protein": number, "carbs": number, "fat": number, "sugar": number, "sodium": number, "fiber": number, "potassium": number, "calcium": number, "iron": number, "vitaminC": number, "saturatedFat": number, "verdictLabel": string (short phrase, e.g. "High in added sugar", "Mostly whole ingredients"), "verdictScore": "green"|"yellow"|"red", "reasons": [string, string, string]}
Base the verdict on standard nutrition heuristics: added sugar, sodium, fiber, protein density, saturated fat, and how processed the ingredient list looks. sodium, potassium, calcium, iron, vitaminC are in mg; everything else in grams except calories (kcal).`;

const TEXT_MEAL_PROMPT = `You are a world-class nutrition scientist and sports dietitian specializing in global cuisine and comprehensive Indian diets (North, South, East, West, regional).
The user will describe what they ate or drank in natural language.

CRITICAL PRECISION & MATHEMATICAL CONSISTENCY RULES:
1. ENERGY BALANCE CONSISTENCY:
   - Total Calories MUST mathematically equal 4 * protein + 4 * carbs + 9 * fat (within ±5 kcal). Never output contradictory calories and macros.
2. STRICT QUANTITY & WEIGHT SCALING:
   - User inputs will specify exact weights (grams: g, gm, gms, grams; kg), volumes (ml, l), spoons (tbsp, tsp), scoops, katoris/bowls, plates, or counts.
   - Scale every macronutrient and micronutrient strictly and linearly to the specified quantity:
     * 100g raw paneer: 260 kcal, 18g protein, 4g carbs, 20g fat -> 250g paneer = 650 kcal, 45g protein, 10g carbs, 50g fat.
     * 100g raw chicken breast: 120 kcal, 22.5g protein, 0g carbs, 2.5g fat; 100g cooked: ~165 kcal, 31g protein, 3.6g fat.
     * 100g cooked white rice: 130 kcal, 2.7g protein, 28g carbs, 0.3g fat -> 200g white rice = 260 kcal, 5.4g protein, 56g carbs.
     * 100g boiled eggs: ~155 kcal, 13g protein, 11g fat -> 1 large egg (~50g) = 75 kcal, 6.3g protein, 5.2g fat.
     * 1 scoop standard whey (30g): 120 kcal, 24g protein, 2g carbs, 1.5g fat.
     * 1 tbsp peanut butter (16g): 95 kcal, 4g protein, 3.5g carbs, 8g fat.
     * 1 standard roti/chapati (35g wheat dough): ~90 kcal, 3.2g protein, 18g carbs, 1g fat.
     * 1 katori/small bowl dal tadka (150g): ~135 kcal, 7.5g protein, 18g carbs, 4g fat.
     * 1 tsp cooking oil / ghee (5g): 45 kcal, 5g fat; 1 tbsp (14g): 125 kcal, 14g fat.
3. ITEMIZATION IN NOTES:
   - In "notes", provide a clear itemized breakdown of detected foods and their calculated calories and macros (e.g. "150g Chicken: 248 kcal, 46g P | 200g Rice: 260 kcal, 5g P, 56g C | 100g Curd: 60 kcal, 3g P").
4. ACCURATE MICRONUTRIENTS:
   - Fiber (g), Sugar (g), Sodium (mg), Potassium (mg), Calcium (mg), Iron (mg), Vitamin C (mg). Provide realistic non-zero estimates based on ingredients.

Respond with ONLY a JSON object, no markdown fences, no commentary, in exactly this shape:
{"name": string, "servingLabel": string, "calories": number, "protein": number, "carbs": number, "fat": number, "fiber": number, "sugar": number, "sodium": number, "potassium": number, "calcium": number, "iron": number, "vitaminC": number, "confidence": "high"|"medium"|"low", "notes": string}`;

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result;
      if (typeof res === "string") {
        resolve(res.split(",")[1]);
      } else {
        reject(new Error("Failed to read file"));
      }
    };
    reader.onerror = () => reject(new Error("Could not read image file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Optimizes an uploaded or camera-captured image for mobile upload & AI vision.
 * - Downscales large iPhone photos (e.g. 12-48MP) to max 1200px.
 * - Converts HEIC/HEIF/PNG into standard compressed image/jpeg (~150-250KB).
 * - Drastically speeds up network transmission and guarantees compatibility.
 */
export function fileToOptimizedImage(file, maxDimension = 1200) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("No image file provided"));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read image file"));
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== "string") {
        return reject(new Error("Failed to read image data"));
      }

      const img = new Image();
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          const optimizedDataUrl = canvas.toDataURL("image/jpeg", 0.85);
          const base64 = optimizedDataUrl.split(",")[1];
          resolve({ base64, mediaType: "image/jpeg" });
        } catch (e) {
          const rawBase64 = dataUrl.split(",")[1];
          resolve({ base64: rawBase64, mediaType: file.type || "image/jpeg" });
        }
      };
      img.onerror = () => {
        const rawBase64 = dataUrl.split(",")[1];
        resolve({ base64: rawBase64, mediaType: file.type || "image/jpeg" });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

const NUMBER_WORDS = {
  half: 0.5,
  "1/2": 0.5,
  quarter: 0.25,
  "1/4": 0.25,
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

const UNIT_ALIASES = {
  grams: "g",
  gram: "g",
  gms: "g",
  gm: "g",
  g: "g",
  kilos: "kg",
  kilo: "kg",
  kgs: "kg",
  kg: "kg",
  milliliters: "ml",
  milliliter: "ml",
  mls: "ml",
  milli: "ml",
  ml: "ml",
  litres: "l",
  liters: "l",
  litre: "l",
  liter: "l",
  l: "l",
  tablespoons: "tbsp",
  tablespoon: "tbsp",
  tbsp: "tbsp",
  teaspoons: "tsp",
  teaspoon: "tsp",
  tsp: "tsp",
  scoops: "scoop",
  scoop: "scoop",
  katoris: "katori",
  katori: "katori",
  bowls: "bowl",
  bowl: "bowl",
  cups: "cup",
  cup: "cup",
  plates: "plate",
  plate: "plate",
  glasses: "glass",
  glass: "glass",
  slices: "slice",
  slice: "slice",
  pieces: "piece",
  piece: "piece",
  pcs: "piece",
  pc: "piece",
};

const UNIT_REGEX_STR = "grams?|gms?|gm|g|kilos?|kgs?|kg|milliliters?|mls?|milli|ml|lit[re]s?|l|tablespoons?|tbsp|teaspoons?|tsp|scoops?|katoris?|bowls?|cups?|plates?|glasses?|slices?|pieces?|pcs?|pc";

function parseQuantityAndUnit(numStr, unitStr) {
  let val = 1;
  if (numStr) {
    const s = numStr.trim().toLowerCase();
    if (NUMBER_WORDS[s] !== undefined) {
      val = NUMBER_WORDS[s];
    } else {
      const parsed = parseFloat(s);
      val = isNaN(parsed) ? 1 : parsed;
    }
  }
  let unit = null;
  if (unitStr) {
    const u = unitStr.trim().toLowerCase();
    unit = UNIT_ALIASES[u] || u;
  }
  return { val, unit };
}

function matchFoodWithQuantity(workingText, foodRegex, itemDef) {
  const match = workingText.match(foodRegex);
  if (!match) return null;

  const matchIdx = match.index;
  const matchLen = match[0].length;

  const preText = workingText.slice(0, matchIdx);
  const postText = workingText.slice(matchIdx + matchLen);

  const preCompoundRegex = new RegExp(`(?:(\\d+(?:\\.\\d+)?|half|quarter|one|two|three|four|five|six|seven|eight|nine|ten|a|an)\\s*(${UNIT_REGEX_STR})?\\s*\\(\\s*(\\d+(?:\\.\\d+)?)\\s*(${UNIT_REGEX_STR})?\\s*\\)\\s*(?:of)?\\s*)$`, "i");
  const preSimpleRegex = new RegExp(`(?:(?:\\(\\s*(\\d+(?:\\.\\d+)?)\\s*(${UNIT_REGEX_STR})?\\s*\\)|(\\d+(?:\\.\\d+)?|half|quarter|one|two|three|four|five|six|seven|eight|nine|ten|a|an)\\s*(${UNIT_REGEX_STR})?)\\s*(?:of)?\\s*)$`, "i");

  const preCompoundMatch = preText.match(preCompoundRegex);
  const preSimpleMatch = preText.match(preSimpleRegex);

  const postRegex = new RegExp(`^(?:\\s*(?:\\(\\s*(\\d+(?:\\.\\d+)?)\\s*(${UNIT_REGEX_STR})?\\s*\\)|(\\d+(?:\\.\\d+)?)\\s*(${UNIT_REGEX_STR})?))`, "i");
  const postMatch = postText.match(postRegex);

  let detectedNum = null;
  let detectedUnit = null;
  let startCut = matchIdx;
  let endCut = matchIdx + matchLen;

  if (postMatch) {
    const numStr = postMatch[1] || postMatch[3];
    const unitStr = postMatch[2] || postMatch[4];
    if (numStr) {
      const p = parseQuantityAndUnit(numStr, unitStr);
      detectedNum = p.val;
      detectedUnit = p.unit;
      endCut += postMatch[0].length;
    }
  }

  if (preCompoundMatch) {
    if (preCompoundMatch[3] && preCompoundMatch[4]) {
      const p = parseQuantityAndUnit(preCompoundMatch[3], preCompoundMatch[4]);
      detectedNum = p.val;
      detectedUnit = p.unit;
    } else {
      const p = parseQuantityAndUnit(preCompoundMatch[1], preCompoundMatch[2]);
      detectedNum = p.val;
      detectedUnit = p.unit;
    }
    startCut -= preCompoundMatch[0].length;
  } else if (preSimpleMatch) {
    const numStr = preSimpleMatch[1] || preSimpleMatch[3];
    const unitStr = preSimpleMatch[2] || preSimpleMatch[4];
    if (numStr) {
      const p = parseQuantityAndUnit(numStr, unitStr);
      if (!detectedUnit && p.unit) {
        detectedUnit = p.unit;
        detectedNum = p.val;
      } else if (detectedNum === null) {
        detectedNum = p.val;
        detectedUnit = p.unit;
      }
      startCut -= preSimpleMatch[0].length;
    }
  }

  // Calculate multiplier
  let multiplier = 1;
  let servingLabel = "";

  const baseGrams = itemDef.baseGrams || 100;
  const defaultCount = itemDef.defaultCount || 1;

  if (detectedUnit === "g") {
    multiplier = detectedNum / baseGrams;
    servingLabel = `${detectedNum}g ${itemDef.name}`;
  } else if (detectedUnit === "kg") {
    multiplier = (detectedNum * 1000) / baseGrams;
    servingLabel = `${detectedNum}kg ${itemDef.name}`;
  } else if (detectedUnit === "ml") {
    multiplier = detectedNum / baseGrams;
    servingLabel = `${detectedNum}ml ${itemDef.name}`;
  } else if (detectedUnit === "l") {
    multiplier = (detectedNum * 1000) / baseGrams;
    servingLabel = `${detectedNum}L ${itemDef.name}`;
  } else if (detectedUnit === "tbsp") {
    const tbspGrams = itemDef.tbspGrams || 15;
    multiplier = (detectedNum * tbspGrams) / baseGrams;
    servingLabel = `${detectedNum} tbsp ${itemDef.name}`;
  } else if (detectedUnit === "tsp") {
    const tspGrams = itemDef.tspGrams || 5;
    multiplier = (detectedNum * tspGrams) / baseGrams;
    servingLabel = `${detectedNum} tsp ${itemDef.name}`;
  } else if (detectedUnit === "scoop") {
    const scoopGrams = itemDef.scoopGrams || 30;
    multiplier = (detectedNum * scoopGrams) / baseGrams;
    servingLabel = `${detectedNum} scoop${detectedNum > 1 ? "s" : ""} ${itemDef.name} (${Math.round(detectedNum * scoopGrams)}g)`;
  } else if (detectedUnit === "katori" || detectedUnit === "bowl") {
    const bowlGrams = itemDef.bowlGrams || 150;
    multiplier = (detectedNum * bowlGrams) / baseGrams;
    servingLabel = `${detectedNum} ${detectedUnit} ${itemDef.name}`;
  } else if (detectedUnit === "plate") {
    const plateGrams = itemDef.plateGrams || 350;
    multiplier = (detectedNum * plateGrams) / baseGrams;
    servingLabel = `${detectedNum} plate ${itemDef.name}`;
  } else if (detectedUnit === "cup") {
    const cupGrams = itemDef.cupGrams || 200;
    multiplier = (detectedNum * cupGrams) / baseGrams;
    servingLabel = `${detectedNum} cup ${itemDef.name}`;
  } else if (detectedUnit === "glass") {
    const glassGrams = itemDef.glassGrams || 250;
    multiplier = (detectedNum * glassGrams) / baseGrams;
    servingLabel = `${detectedNum} glass ${itemDef.name}`;
  } else if (detectedUnit === "piece" || detectedUnit === "slice") {
    multiplier = detectedNum * (itemDef.unitGrams ? itemDef.unitGrams / baseGrams : 1);
    servingLabel = `${detectedNum} ${detectedUnit}${detectedNum > 1 ? "s" : ""} ${itemDef.name}`;
  } else if (detectedNum !== null) {
    if (itemDef.isGramItem && !itemDef.unitGrams) {
      if (detectedNum >= 20) {
        multiplier = detectedNum / baseGrams;
        servingLabel = `${detectedNum}g ${itemDef.name}`;
      } else {
        multiplier = detectedNum;
        servingLabel = `${detectedNum}x ${itemDef.name}`;
      }
    } else {
      multiplier = detectedNum * (itemDef.unitGrams ? itemDef.unitGrams / baseGrams : 1);
      servingLabel = `${detectedNum > 1 ? detectedNum + "x " : detectedNum === 0.5 ? "1/2 " : ""}${itemDef.name}`;
    }
  } else {
    multiplier = defaultCount * (itemDef.unitGrams ? itemDef.unitGrams / baseGrams : 1);
    servingLabel = `${defaultCount > 1 ? defaultCount + "x " : ""}${itemDef.name}`;
  }

  const newWorkingText = workingText.slice(0, startCut) + " " + workingText.slice(endCut);

  return {
    multiplier,
    servingLabel,
    newWorkingText,
  };
}

/**
 * Comprehensive Indian & Global Food Database with Per-Base Nutritional Values
 * Enables exact gram, ml, spoon, scoop, and count scaling.
 */
const FOOD_DATABASE = [
  // 1. Indian Breads & Roti Variations
  {
    regex: /(?:roti with ghee|ghee rotis?|ghee chapatis?)/i,
    name: "ghee roti",
    baseGrams: 40,
    unitGrams: 40,
    defaultCount: 2,
    cal: 145, p: 3.2, c: 21, f: 5.5, fib: 2.5, sug: 0.5, sod: 95, pot: 80, calc: 15, fe: 1.2, vitc: 0,
  },
  {
    regex: /(?:aloo parathas?|alu parathas?)/i,
    name: "aloo paratha",
    baseGrams: 120,
    unitGrams: 120,
    defaultCount: 1,
    cal: 290, p: 5.5, c: 42, f: 11.5, fib: 4, sug: 1.5, sod: 380, pot: 220, calc: 25, fe: 1.8, vitc: 4,
  },
  {
    regex: /(?:paneer parathas?)/i,
    name: "paneer paratha",
    baseGrams: 130,
    unitGrams: 130,
    defaultCount: 1,
    cal: 340, p: 14, c: 34, f: 16, fib: 3.5, sug: 1, sod: 360, pot: 210, calc: 220, fe: 1.5, vitc: 1,
  },
  {
    regex: /(?:gobi parathas?|methi parathas?|mooli parathas?)/i,
    name: "stuffed paratha",
    baseGrams: 110,
    unitGrams: 110,
    defaultCount: 1,
    cal: 230, p: 5, c: 32, f: 9.5, fib: 4.5, sug: 1, sod: 340, pot: 240, calc: 60, fe: 2.2, vitc: 8,
  },
  {
    regex: /(?:plain parathas?|parathas?|parottas?)/i,
    name: "paratha",
    baseGrams: 80,
    unitGrams: 80,
    defaultCount: 2,
    cal: 200, p: 4.2, c: 28, f: 8.5, fib: 3, sug: 0.5, sod: 180, pot: 90, calc: 20, fe: 1.4, vitc: 0,
  },
  {
    regex: /(?:butter naans?|garlic naans?|cheese naans?)/i,
    name: "naan",
    baseGrams: 100,
    unitGrams: 100,
    defaultCount: 1,
    cal: 290, p: 8, c: 46, f: 8.5, fib: 2, sug: 2, sod: 380, pot: 110, calc: 55, fe: 1.6, vitc: 0,
  },
  {
    regex: /(?:plain naans?|naans?|tandoori rotis?)/i,
    name: "naan/tandoori roti",
    baseGrams: 90,
    unitGrams: 90,
    defaultCount: 1,
    cal: 260, p: 7.5, c: 45, f: 6, fib: 2, sug: 1.5, sod: 340, pot: 95, calc: 40, fe: 1.5, vitc: 0,
  },
  {
    regex: /(?:rotis?|chapatis?|phulkas?|fulkas?)/i,
    name: "roti",
    baseGrams: 35,
    unitGrams: 35,
    defaultCount: 2,
    cal: 105, p: 3.2, c: 21, f: 1.5, fib: 2.5, sug: 0.3, sod: 90, pot: 80, calc: 15, fe: 1.2, vitc: 0,
  },
  {
    regex: /(?:theplas?|methi theplas?)/i,
    name: "thepla",
    baseGrams: 45,
    unitGrams: 45,
    defaultCount: 2,
    cal: 130, p: 3.5, c: 18, f: 5, fib: 2.5, sug: 0.5, sod: 140, pot: 90, calc: 45, fe: 1.8, vitc: 3,
  },
  {
    regex: /(?:bhakris?|jowar rotis?|bajra rotis?|ragi rotis?)/i,
    name: "millet roti",
    baseGrams: 50,
    unitGrams: 50,
    defaultCount: 1,
    cal: 120, p: 3.8, c: 24, f: 1.2, fib: 4, sug: 0.2, sod: 30, pot: 120, calc: 35, fe: 2.5, vitc: 0,
  },
  {
    regex: /(?:puris?|pooris?)/i,
    name: "puri",
    baseGrams: 30,
    unitGrams: 30,
    defaultCount: 2,
    cal: 130, p: 2.2, c: 16, f: 6.5, fib: 1.5, sug: 0.2, sod: 95, pot: 40, calc: 10, fe: 0.8, vitc: 0,
  },
  {
    regex: /(?:bhaturas?|bhatures?)/i,
    name: "bhatura",
    baseGrams: 90,
    unitGrams: 90,
    defaultCount: 1,
    cal: 290, p: 6, c: 42, f: 11, fib: 2, sug: 1.5, sod: 280, pot: 85, calc: 25, fe: 1.4, vitc: 0,
  },

  // 2. Indian Rice, Biryani & Khichdi
  {
    regex: /(?:chicken biryani|murgh biryani)/i,
    name: "chicken biryani",
    baseGrams: 100,
    plateGrams: 350,
    bowlGrams: 200,
    isGramItem: true,
    defaultCount: 3.5,
    cal: 165, p: 9.7, c: 18.8, f: 5.7, fib: 1, sug: 1, sod: 205, pot: 111, calc: 13, fe: 0.8, vitc: 1.1,
  },
  {
    regex: /(?:mutton biryani|lamb biryani)/i,
    name: "mutton biryani",
    baseGrams: 100,
    plateGrams: 350,
    bowlGrams: 200,
    isGramItem: true,
    defaultCount: 3.5,
    cal: 195, p: 9.1, c: 18.3, f: 9.1, fib: 1, sug: 0.8, sod: 217, pot: 117, calc: 14, fe: 1.1, vitc: 0.9,
  },
  {
    regex: /(?:egg biryani|anda biryani)/i,
    name: "egg biryani",
    baseGrams: 100,
    plateGrams: 350,
    bowlGrams: 200,
    isGramItem: true,
    defaultCount: 3.5,
    cal: 148, p: 5.7, c: 19.4, f: 5.1, fib: 1, sug: 0.8, sod: 194, pot: 88, calc: 16, fe: 0.7, vitc: 0.6,
  },
  {
    regex: /(?:veg biryani|vegetable biryani|paneer biryani)/i,
    name: "veg biryani",
    baseGrams: 100,
    plateGrams: 350,
    bowlGrams: 200,
    isGramItem: true,
    defaultCount: 3.5,
    cal: 125, p: 3.1, c: 20, f: 4, fib: 1.6, sug: 1.2, sod: 165, pot: 91, calc: 27, fe: 0.7, vitc: 1.7,
  },
  {
    regex: /(?:khichdi|dal khichdi|moong khichdi)/i,
    name: "dal khichdi",
    baseGrams: 100,
    bowlGrams: 250,
    isGramItem: true,
    defaultCount: 2.5,
    cal: 104, p: 3.8, c: 17.6, f: 2, fib: 2, sug: 0.5, sod: 152, pot: 112, calc: 16, fe: 1, vitc: 0.8,
  },
  {
    regex: /(?:curd rice|thayir sadam)/i,
    name: "curd rice",
    baseGrams: 100,
    bowlGrams: 200,
    isGramItem: true,
    defaultCount: 2,
    cal: 120, p: 3.2, c: 19, f: 3.5, fib: 0.7, sug: 2.2, sod: 110, pot: 90, calc: 70, fe: 0.3, vitc: 0.5,
  },
  {
    regex: /(?:jeera rice|pulao|veg pulao|matar pulao)/i,
    name: "pulao/jeera rice",
    baseGrams: 100,
    bowlGrams: 180,
    isGramItem: true,
    defaultCount: 1.8,
    cal: 140, p: 2.5, c: 25, f: 3.3, fib: 1.1, sug: 0.5, sod: 133, pot: 53, calc: 11, fe: 0.4, vitc: 1.1,
  },
  {
    regex: /(?:brown rice)/i,
    name: "brown rice",
    baseGrams: 100,
    bowlGrams: 175,
    isGramItem: true,
    defaultCount: 1.75,
    cal: 123, p: 2.7, c: 25.6, f: 1, fib: 1.8, sug: 0.2, sod: 5, pot: 48, calc: 9, fe: 0.5, vitc: 0,
  },
  {
    regex: /(?:white rice|steamed rice|boiled rice|cooked rice|rice|chawal)/i,
    name: "steamed rice",
    baseGrams: 100,
    bowlGrams: 160,
    isGramItem: true,
    defaultCount: 1.6,
    cal: 130, p: 2.7, c: 28, f: 0.3, fib: 0.4, sug: 0.1, sod: 3, pot: 35, calc: 6, fe: 0.2, vitc: 0,
  },

  // 3. Indian Dals, Legumes & Curries
  {
    regex: /(?:dal makhani|maa ki dal)/i,
    name: "dal makhani",
    baseGrams: 100,
    bowlGrams: 200,
    isGramItem: true,
    defaultCount: 2,
    cal: 170, p: 5.5, c: 14, f: 10, fib: 3.5, sug: 1, sod: 240, pot: 170, calc: 60, fe: 1.7, vitc: 1,
  },
  {
    regex: /(?:chole|chana masala|chickpea curry|chhole)/i,
    name: "chana masala/chole",
    baseGrams: 100,
    bowlGrams: 200,
    isGramItem: true,
    defaultCount: 2,
    cal: 140, p: 6, c: 19, f: 4.5, fib: 4.7, sug: 2, sod: 230, pot: 240, calc: 40, fe: 1.9, vitc: 3,
  },
  {
    regex: /(?:rajma|rajma masala|kidney beans)/i,
    name: "rajma",
    baseGrams: 100,
    bowlGrams: 200,
    isGramItem: true,
    defaultCount: 2,
    cal: 135, p: 6.5, c: 19, f: 3.7, fib: 5, sug: 1.8, sod: 220, pot: 260, calc: 38, fe: 2.1, vitc: 2.5,
  },
  {
    regex: /(?:dal tadka|yellow dal|toor dal|arhar dal|dal fry|moong dal|dal|bowl of dal)/i,
    name: "dal tadka",
    baseGrams: 100,
    bowlGrams: 160,
    isGramItem: true,
    defaultCount: 1.6,
    cal: 110, p: 6.8, c: 16, f: 2.8, fib: 4, sug: 0.8, sod: 210, pot: 225, calc: 25, fe: 2, vitc: 1.8,
  },
  {
    regex: /(?:sambar|sambhar)/i,
    name: "sambar",
    baseGrams: 100,
    bowlGrams: 200,
    isGramItem: true,
    defaultCount: 2,
    cal: 65, p: 2.5, c: 10, f: 1.8, fib: 2.2, sug: 2.5, sod: 180, pot: 120, calc: 18, fe: 0.9, vitc: 4,
  },
  {
    regex: /(?:kadhi|kadhi pakora|gujarati kadhi)/i,
    name: "kadhi",
    baseGrams: 100,
    bowlGrams: 200,
    isGramItem: true,
    defaultCount: 2,
    cal: 115, p: 3.5, c: 10.5, f: 6.5, fib: 1, sug: 2.8, sod: 210, pot: 105, calc: 90, fe: 0.6, vitc: 1,
  },

  // 4. Indian Paneer & Vegetarian Sabzis
  {
    regex: /(?:paneer butter masala|shahi paneer|paneer makhani)/i,
    name: "paneer butter masala",
    baseGrams: 100,
    bowlGrams: 200,
    isGramItem: true,
    defaultCount: 2,
    cal: 195, p: 8, c: 7, f: 15, fib: 1.5, sug: 3.5, sod: 210, pot: 140, calc: 190, fe: 0.8, vitc: 2,
  },
  {
    regex: /(?:palak paneer|saag paneer)/i,
    name: "palak paneer",
    baseGrams: 100,
    bowlGrams: 200,
    isGramItem: true,
    defaultCount: 2,
    cal: 140, p: 7.5, c: 4.5, f: 10, fib: 2.2, sug: 1.8, sod: 180, pot: 195, calc: 210, fe: 1.8, vitc: 7,
  },
  {
    regex: /(?:paneer bhurji|kadai paneer|kadhai paneer|paneer tikka)/i,
    name: "paneer dish",
    baseGrams: 100,
    bowlGrams: 150,
    isGramItem: true,
    defaultCount: 1.5,
    cal: 200, p: 12, c: 5, f: 15, fib: 1.6, sug: 1.5, sod: 226, pot: 146, calc: 240, fe: 0.8, vitc: 4,
  },
  {
    regex: /(?:matar paneer|mutter paneer)/i,
    name: "matar paneer",
    baseGrams: 100,
    bowlGrams: 200,
    isGramItem: true,
    defaultCount: 2,
    cal: 155, p: 7, c: 9, f: 9.5, fib: 2.2, sug: 2.5, sod: 175, pot: 140, calc: 145, fe: 0.9, vitc: 4,
  },
  {
    regex: /(?:paneer|raw paneer|cottage cheese)/i,
    name: "paneer",
    baseGrams: 100,
    isGramItem: true,
    defaultCount: 1,
    cal: 260, p: 18, c: 4, f: 20, fib: 0, sug: 2.5, sod: 20, pot: 80, calc: 350, fe: 0.4, vitc: 0,
  },
  {
    regex: /(?:aloo gobi|alu gobi)/i,
    name: "aloo gobi",
    baseGrams: 100,
    bowlGrams: 150,
    isGramItem: true,
    defaultCount: 1.5,
    cal: 120, p: 2.6, c: 16, f: 5.3, fib: 3, sug: 2, sod: 213, pot: 213, calc: 23, fe: 1.1, vitc: 16,
  },
  {
    regex: /(?:aloo matar|jeera aloo|aloo sabzi|dum aloo)/i,
    name: "aloo sabzi",
    baseGrams: 100,
    bowlGrams: 150,
    isGramItem: true,
    defaultCount: 1.5,
    cal: 125, p: 2.6, c: 17, f: 5.3, fib: 2.6, sug: 2.2, sod: 206, pot: 226, calc: 17, fe: 1, vitc: 8,
  },
  {
    regex: /(?:bhindi|bhindi masala|okra|lady finger)/i,
    name: "bhindi masala",
    baseGrams: 100,
    bowlGrams: 150,
    isGramItem: true,
    defaultCount: 1.5,
    cal: 95, p: 2, c: 9.5, f: 5.7, fib: 3, sug: 2, sod: 186, pot: 160, calc: 47, fe: 0.8, vitc: 12,
  },
  {
    regex: /(?:baingan bharta|baingan|eggplant)/i,
    name: "baingan bharta",
    baseGrams: 100,
    bowlGrams: 150,
    isGramItem: true,
    defaultCount: 1.5,
    cal: 105, p: 2, c: 10, f: 6.7, fib: 3.3, sug: 3.5, sod: 193, pot: 173, calc: 20, fe: 0.9, vitc: 5.3,
  },
  {
    regex: /(?:mix veg|mixed vegetable|subzi|sabji|sabzi)/i,
    name: "mixed sabzi",
    baseGrams: 100,
    bowlGrams: 150,
    isGramItem: true,
    defaultCount: 1.5,
    cal: 105, p: 2.6, c: 12, f: 5.7, fib: 3, sug: 3, sod: 193, pot: 180, calc: 30, fe: 1, vitc: 10,
  },
  {
    regex: /(?:malai kofta)/i,
    name: "malai kofta",
    baseGrams: 100,
    bowlGrams: 200,
    isGramItem: true,
    defaultCount: 2,
    cal: 210, p: 4.5, c: 13, f: 16, fib: 1.5, sug: 4, sod: 220, pot: 130, calc: 70, fe: 0.8, vitc: 2,
  },

  // 5. Indian Non-Veg Specialties
  {
    regex: /(?:butter chicken|murgh makhani)/i,
    name: "butter chicken",
    baseGrams: 100,
    bowlGrams: 220,
    isGramItem: true,
    defaultCount: 2.2,
    cal: 210, p: 14.5, c: 5.5, f: 14.5, fib: 0.9, sug: 3.2, sod: 255, pot: 145, calc: 36, fe: 1, vitc: 1.8,
  },
  {
    regex: /(?:chicken tikka|tandoori chicken|tandoori)/i,
    name: "tandoori chicken",
    baseGrams: 100,
    bowlGrams: 160,
    isGramItem: true,
    defaultCount: 1.6,
    cal: 150, p: 22.5, c: 2, f: 5.6, fib: 0.3, sug: 0.8, sod: 300, pot: 225, calc: 16, fe: 1.1, vitc: 1.2,
  },
  {
    regex: /(?:chicken curry|desi chicken curry|home chicken curry)/i,
    name: "chicken curry",
    baseGrams: 100,
    bowlGrams: 200,
    isGramItem: true,
    defaultCount: 2,
    cal: 145, p: 15, c: 3.5, f: 7.5, fib: 0.7, sug: 1.5, sod: 210, pot: 170, calc: 15, fe: 1, vitc: 2,
  },
  {
    regex: /(?:mutton curry|rogan josh|mutton korma|goat curry)/i,
    name: "mutton curry",
    baseGrams: 100,
    bowlGrams: 200,
    isGramItem: true,
    defaultCount: 2,
    cal: 205, p: 14, c: 3, f: 15.5, fib: 0.5, sug: 1.2, sod: 230, pot: 155, calc: 17, fe: 2.1, vitc: 1,
  },
  {
    regex: /(?:fish curry|machher jhol|meen curry)/i,
    name: "fish curry",
    baseGrams: 100,
    bowlGrams: 200,
    isGramItem: true,
    defaultCount: 2,
    cal: 120, p: 13, c: 2.5, f: 6, fib: 0.5, sug: 1, sod: 190, pot: 225, calc: 22, fe: 0.8, vitc: 1.5,
  },
  {
    regex: /(?:egg curry|anda curry)/i,
    name: "egg curry",
    baseGrams: 100,
    bowlGrams: 185,
    isGramItem: true,
    defaultCount: 1.85,
    cal: 135, p: 7.5, c: 3.8, f: 9.7, fib: 0.8, sug: 1.5, sod: 173, pot: 113, calc: 32, fe: 1.1, vitc: 1.6,
  },
  {
    regex: /(?:egg bhurji|anda bhurji)/i,
    name: "egg bhurji",
    baseGrams: 100,
    bowlGrams: 140,
    isGramItem: true,
    defaultCount: 1.4,
    cal: 165, p: 10.7, c: 2.8, f: 12, fib: 0.7, sug: 1.2, sod: 200, pot: 135, calc: 39, fe: 1.4, vitc: 2.8,
  },

  // 6. South Indian & Breakfast Delights
  {
    regex: /(?:idli|idlis)/i,
    name: "idli",
    baseGrams: 40,
    unitGrams: 40,
    defaultCount: 2,
    cal: 30, p: 1, c: 6, f: 0.15, fib: 0.5, sug: 0.2, sod: 55, pot: 17, calc: 5, fe: 0.2, vitc: 0,
  },
  {
    regex: /(?:masala dosas?)/i,
    name: "masala dosa",
    baseGrams: 180,
    unitGrams: 180,
    defaultCount: 1,
    cal: 310, p: 6, c: 44, f: 12, fib: 4, sug: 2.5, sod: 420, pot: 280, calc: 35, fe: 1.8, vitc: 6,
  },
  {
    regex: /(?:plain dosas?|dosas?|paper dosas?)/i,
    name: "dosa",
    baseGrams: 100,
    unitGrams: 100,
    defaultCount: 1,
    cal: 150, p: 3.5, c: 26, f: 3.8, fib: 1.5, sug: 0.5, sod: 240, pot: 80, calc: 18, fe: 0.9, vitc: 0,
  },
  {
    regex: /(?:medu vadas?|vadas?)/i,
    name: "medu vada",
    baseGrams: 50,
    unitGrams: 50,
    defaultCount: 1,
    cal: 140, p: 4, c: 14, f: 8, fib: 2, sug: 0.3, sod: 180, pot: 120, calc: 20, fe: 1.2, vitc: 0,
  },
  {
    regex: /(?:uttapam|onion uttapam)/i,
    name: "uttapam",
    baseGrams: 140,
    unitGrams: 140,
    defaultCount: 1,
    cal: 220, p: 5, c: 36, f: 6.5, fib: 3, sug: 2.8, sod: 290, pot: 140, calc: 25, fe: 1.4, vitc: 4,
  },
  {
    regex: /(?:poha|kanda poha|batata poha)/i,
    name: "poha",
    baseGrams: 100,
    plateGrams: 160,
    isGramItem: true,
    defaultCount: 1.6,
    cal: 150, p: 2.8, c: 26, f: 4, fib: 1.8, sug: 1.8, sod: 175, pot: 100, calc: 19, fe: 1.5, vitc: 5,
  },
  {
    regex: /(?:upma|rava upma)/i,
    name: "upma",
    baseGrams: 100,
    plateGrams: 160,
    isGramItem: true,
    defaultCount: 1.6,
    cal: 145, p: 3.1, c: 22.5, f: 4.7, fib: 1.5, sug: 1.2, sod: 181, pot: 69, calc: 12, fe: 0.8, vitc: 1.2,
  },
  {
    regex: /(?:besan chilla|chilla|cheela|moong chilla)/i,
    name: "chilla",
    baseGrams: 90,
    unitGrams: 90,
    defaultCount: 1,
    cal: 170, p: 9, c: 20, f: 6, fib: 4, sug: 1.5, sod: 260, pot: 240, calc: 40, fe: 2.8, vitc: 3,
  },
  {
    regex: /(?:chole bhature|chana bhatura)/i,
    name: "chole bhature",
    baseGrams: 350,
    unitGrams: 350,
    defaultCount: 1,
    cal: 820, p: 18, c: 95, f: 40, fib: 12, sug: 5, sod: 780, pot: 540, calc: 110, fe: 5.2, vitc: 8,
  },
  {
    regex: /(?:puri bhaji|poori bhaji|poori sabzi)/i,
    name: "puri bhaji",
    baseGrams: 250,
    unitGrams: 250,
    defaultCount: 1,
    cal: 450, p: 7, c: 56, f: 22, fib: 6, sug: 4, sod: 480, pot: 380, calc: 40, fe: 2.4, vitc: 14,
  },

  // 7. Dairy, Beverages, Accompaniments
  {
    regex: /(?:dahi|curd|bowl of curd|katori of curd|cup of curd)/i,
    name: "curd (dahi)",
    baseGrams: 100,
    bowlGrams: 150,
    cupGrams: 150,
    isGramItem: true,
    defaultCount: 1.5,
    cal: 65, p: 3.3, c: 4, f: 3.3, fib: 0, sug: 4, sod: 36, pot: 140, calc: 120, fe: 0.1, vitc: 0,
  },
  {
    regex: /(?:raita|boondi raita|cucumber raita)/i,
    name: "raita",
    baseGrams: 100,
    bowlGrams: 120,
    isGramItem: true,
    defaultCount: 1.2,
    cal: 100, p: 3.3, c: 6.7, f: 5, fib: 0.4, sug: 3.5, sod: 183, pot: 158, calc: 125, fe: 0.2, vitc: 1.6,
  },
  {
    regex: /(?:chaas|chach|buttermilk|masala chaas)/i,
    name: "chaas",
    baseGrams: 100,
    glassGrams: 200,
    defaultCount: 2,
    cal: 25, p: 1.2, c: 2, f: 1, fib: 0, sug: 2, sod: 80, pot: 70, calc: 60, fe: 0.1, vitc: 0,
  },
  {
    regex: /(?:lassi|sweet lassi|mango lassi)/i,
    name: "lassi",
    baseGrams: 100,
    glassGrams: 250,
    defaultCount: 2.5,
    cal: 96, p: 2.4, c: 14.4, f: 3.2, fib: 0, sug: 14, sod: 38, pot: 112, calc: 88, fe: 0.1, vitc: 0.8,
  },
  {
    regex: /(?:masala chai|adrak chai|ginger tea|chai|tea|cup of chai)/i,
    name: "chai",
    baseGrams: 100,
    cupGrams: 150,
    defaultCount: 1.5,
    cal: 63, p: 1.7, c: 9.3, f: 2.3, fib: 0, sug: 9, sod: 30, pot: 80, calc: 56, fe: 0.1, vitc: 0,
  },
  {
    regex: /(?:filter coffee|south indian coffee)/i,
    name: "filter coffee",
    baseGrams: 100,
    cupGrams: 150,
    defaultCount: 1.5,
    cal: 60, p: 1.7, c: 8, f: 2.3, fib: 0, sug: 7.5, sod: 30, pot: 86, calc: 53, fe: 0.1, vitc: 0,
  },
  {
    regex: /(?:ghee|spoon of ghee|tbsp ghee|tsp ghee)/i,
    name: "ghee",
    baseGrams: 100,
    tbspGrams: 15,
    tspGrams: 5,
    isGramItem: true,
    defaultCount: 0.06,
    cal: 900, p: 0, c: 0, f: 100, fib: 0, sug: 0, sod: 0, pot: 0, calc: 0, fe: 0, vitc: 0,
  },
  // Peanut butter before butter to avoid substring false positive
  {
    regex: /(?:peanut butter|almond butter)/i,
    name: "peanut butter",
    baseGrams: 32,
    tbspGrams: 16,
    tspGrams: 5,
    isGramItem: true,
    defaultCount: 1,
    cal: 190, p: 8, c: 7, f: 16, fib: 2, sug: 3, sod: 140, pot: 190, calc: 15, fe: 0.6, vitc: 0,
  },
  {
    regex: /(?:butter|amul butter|makkhan)/i,
    name: "butter",
    baseGrams: 100,
    tbspGrams: 14,
    tspGrams: 5,
    isGramItem: true,
    defaultCount: 0.1,
    cal: 720, p: 0.8, c: 0.1, f: 81, fib: 0, sug: 0.1, sod: 650, pot: 25, calc: 24, fe: 0, vitc: 0,
  },
  {
    regex: /(?:papad|roasted papad|fry papad)/i,
    name: "papad",
    baseGrams: 12,
    unitGrams: 12,
    defaultCount: 1,
    cal: 40, p: 2, c: 6, f: 0.5, fib: 1, sug: 0.2, sod: 180, pot: 60, calc: 15, fe: 0.6, vitc: 0,
  },
  {
    regex: /(?:green chutney|mint chutney|coriander chutney)/i,
    name: "chutney",
    baseGrams: 100,
    tbspGrams: 15,
    isGramItem: true,
    defaultCount: 0.3,
    cal: 80, p: 2.5, c: 8, f: 4, fib: 3, sug: 2, sod: 400, pot: 280, calc: 80, fe: 2.5, vitc: 40,
  },

  // 8. Indian Snacks & Street Food
  {
    regex: /(?:samosa|aloo samosa)/i,
    name: "samosa",
    baseGrams: 80,
    unitGrams: 80,
    defaultCount: 1,
    cal: 260, p: 4, c: 28, f: 14.5, fib: 2.5, sug: 1.5, sod: 360, pot: 180, calc: 20, fe: 1.2, vitc: 4,
  },
  {
    regex: /(?:pakora|pakoda|bhajiya|onion pakora)/i,
    name: "pakora",
    baseGrams: 100,
    isGramItem: true,
    defaultCount: 1,
    cal: 290, p: 5, c: 28, f: 17, fib: 3, sug: 2.5, sod: 380, pot: 190, calc: 30, fe: 1.5, vitc: 5,
  },
  {
    regex: /(?:pav bhaji)/i,
    name: "pav bhaji",
    baseGrams: 300,
    unitGrams: 300,
    defaultCount: 1,
    cal: 490, p: 9, c: 68, f: 20, fib: 6.5, sug: 7, sod: 680, pot: 420, calc: 60, fe: 2.8, vitc: 22,
  },
  {
    regex: /(?:vada pav)/i,
    name: "vada pav",
    baseGrams: 120,
    unitGrams: 120,
    defaultCount: 1,
    cal: 300, p: 6, c: 42, f: 12, fib: 3, sug: 3.5, sod: 440, pot: 210, calc: 30, fe: 1.6, vitc: 4,
  },
  {
    regex: /(?:dhokla|khaman dhokla|khaman)/i,
    name: "dhokla",
    baseGrams: 50,
    unitGrams: 50,
    defaultCount: 2,
    cal: 75, p: 2.5, c: 12, f: 2, fib: 1, sug: 2, sod: 190, pot: 45, calc: 12, fe: 0.5, vitc: 0.5,
  },
  {
    regex: /(?:pani puri|golgappa|puchka)/i,
    name: "pani puri",
    baseGrams: 150,
    unitGrams: 25,
    defaultCount: 6,
    cal: 32, p: 0.5, c: 5.7, f: 0.75, fib: 0.5, sug: 1, sod: 60, pot: 23, calc: 3, fe: 0.2, vitc: 1.3,
  },
  {
    regex: /(?:gulab jamun)/i,
    name: "gulab jamun",
    baseGrams: 45,
    unitGrams: 45,
    defaultCount: 1,
    cal: 150, p: 2.5, c: 24, f: 5.5, fib: 0.5, sug: 20, sod: 45, pot: 40, calc: 55, fe: 0.3, vitc: 0,
  },
  {
    regex: /(?:rasgulla)/i,
    name: "rasgulla",
    baseGrams: 45,
    unitGrams: 45,
    defaultCount: 1,
    cal: 120, p: 3, c: 22, f: 2, fib: 0, sug: 18, sod: 30, pot: 35, calc: 65, fe: 0.2, vitc: 0,
  },
  {
    regex: /(?:kheer|payasam)/i,
    name: "kheer",
    baseGrams: 100,
    bowlGrams: 160,
    isGramItem: true,
    defaultCount: 1.6,
    cal: 150, p: 3.1, c: 21, f: 5.3, fib: 0.3, sug: 16, sod: 47, pot: 118, calc: 100, fe: 0.2, vitc: 0,
  },
  {
    regex: /(?:halwa|gajar halwa|sooji halwa)/i,
    name: "halwa",
    baseGrams: 100,
    bowlGrams: 130,
    isGramItem: true,
    defaultCount: 1.3,
    cal: 240, p: 3.5, c: 32, f: 11, fib: 1.5, sug: 22, sod: 65, pot: 138, calc: 54, fe: 0.7, vitc: 2.3,
  },

  // 9. Global Health & Fitness Staples
  {
    regex: /(?:chicken breast|grilled chicken)/i,
    name: "grilled chicken",
    baseGrams: 100,
    unitGrams: 150,
    isGramItem: true,
    defaultCount: 1.5,
    cal: 165, p: 31, c: 0, f: 3.6, fib: 0, sug: 0, sod: 80, pot: 256, calc: 12, fe: 1, vitc: 0,
  },
  {
    regex: /(?:salmon|fish fillet|tuna)/i,
    name: "fish",
    baseGrams: 100,
    unitGrams: 140,
    isGramItem: true,
    defaultCount: 1.4,
    cal: 180, p: 22, c: 0, f: 10, fib: 0, sug: 0, sod: 60, pot: 340, calc: 10, fe: 0.6, vitc: 0,
  },
  {
    regex: /(?:boiled eggs?|hard boiled eggs?)/i,
    name: "boiled egg",
    baseGrams: 50,
    unitGrams: 50,
    defaultCount: 2,
    cal: 74, p: 6.3, c: 0.4, f: 5, fib: 0, sug: 0.4, sod: 70, pot: 70, calc: 25, fe: 0.9, vitc: 0,
  },
  {
    regex: /(?:scrambled eggs?|fried eggs?|omelette|omelet)/i,
    name: "eggs",
    baseGrams: 60,
    unitGrams: 60,
    defaultCount: 2,
    cal: 95, p: 6.5, c: 0.8, f: 7.5, fib: 0, sug: 0.7, sod: 120, pot: 85, calc: 30, fe: 1, vitc: 0,
  },
  {
    regex: /(?:eggs?)/i,
    name: "egg",
    baseGrams: 50,
    unitGrams: 50,
    defaultCount: 2,
    cal: 74, p: 6.3, c: 0.4, f: 5, fib: 0, sug: 0.4, sod: 70, pot: 70, calc: 25, fe: 0.9, vitc: 0,
  },
  {
    regex: /(?:toast|bread|slice of bread|sourdough)/i,
    name: "toast",
    baseGrams: 30,
    unitGrams: 30,
    defaultCount: 2,
    cal: 80, p: 3.5, c: 14, f: 1.2, fib: 1.5, sug: 1.5, sod: 130, pot: 45, calc: 30, fe: 0.8, vitc: 0,
  },
  {
    regex: /(?:avocado|guacamole)/i,
    name: "avocado",
    baseGrams: 100,
    unitGrams: 150,
    isGramItem: true,
    defaultCount: 0.5,
    cal: 160, p: 2, c: 8.5, f: 14.5, fib: 6.7, sug: 0.7, sod: 7, pot: 485, calc: 12, fe: 0.6, vitc: 10,
  },
  {
    regex: /(?:protein shake|whey protein|scoop of protein|whey)/i,
    name: "whey protein",
    baseGrams: 30,
    scoopGrams: 30,
    defaultCount: 1,
    cal: 120, p: 24, c: 2, f: 1.5, fib: 0.5, sug: 1, sod: 140, pot: 120, calc: 140, fe: 0.5, vitc: 0,
  },
  {
    regex: /(?:banana)/i,
    name: "banana",
    baseGrams: 118,
    unitGrams: 118,
    defaultCount: 1,
    cal: 105, p: 1.3, c: 27, f: 0.3, fib: 3.1, sug: 14.4, sod: 1, pot: 420, calc: 6, fe: 0.3, vitc: 10,
  },
  {
    regex: /(?:apple)/i,
    name: "apple",
    baseGrams: 180,
    unitGrams: 180,
    defaultCount: 1,
    cal: 95, p: 0.5, c: 25, f: 0.3, fib: 4.4, sug: 19, sod: 2, pot: 195, calc: 11, fe: 0.2, vitc: 8,
  },
  {
    regex: /(?:milk|cup of milk|glass of milk)/i,
    name: "milk",
    baseGrams: 100,
    glassGrams: 250,
    cupGrams: 200,
    defaultCount: 2.5,
    cal: 60, p: 3.2, c: 4.8, f: 3.2, fib: 0, sug: 4.8, sod: 42, pot: 144, calc: 116, fe: 0.1, vitc: 0,
  },
  {
    regex: /(?:oats|oatmeal|porridge)/i,
    name: "oats",
    baseGrams: 40,
    bowlGrams: 60,
    isGramItem: true,
    defaultCount: 1,
    cal: 155, p: 5.5, c: 26.5, f: 2.8, fib: 4, sug: 0.5, sod: 2, pot: 150, calc: 20, fe: 1.8, vitc: 0,
  },
  {
    regex: /(?:black coffee|espresso|americano)/i,
    name: "black coffee",
    baseGrams: 100,
    cupGrams: 200,
    defaultCount: 2,
    cal: 2, p: 0.1, c: 0, f: 0, fib: 0, sug: 0, sod: 2, pot: 50, calc: 2, fe: 0, vitc: 0,
  },
  {
    regex: /(?:green salad|salad|cucumber|tomato salad)/i,
    name: "salad",
    baseGrams: 100,
    bowlGrams: 200,
    isGramItem: true,
    defaultCount: 2,
    cal: 25, p: 1.3, c: 4.5, f: 0.3, fib: 1.8, sug: 2.5, sod: 23, pot: 140, calc: 30, fe: 0.8, vitc: 13,
  },
  {
    regex: /(?:almonds|badam|walnuts|nuts)/i,
    name: "nuts/almonds",
    baseGrams: 28,
    isGramItem: true,
    defaultCount: 1,
    cal: 160, p: 6, c: 6, f: 14, fib: 3.5, sug: 1.2, sod: 1, pot: 200, calc: 75, fe: 1, vitc: 0,
  },
];

/**
 * Intelligent offline heuristic parser for natural language meal descriptions.
 * Accurately parses quantities with units (grams, milliliters, spoons, scoops, bowls, etc.)
 * and scales calories, macronutrients, and micronutrients accordingly.
 */
export function parseMealTextOffline(text) {
  let workingText = text.toLowerCase();

  let calories = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  let fiber = 0;
  let sugar = 0;
  let sodium = 0;
  let potassium = 0;
  let calcium = 0;
  let iron = 0;
  let vitaminC = 0;

  const detectedItems = [];

  for (const item of FOOD_DATABASE) {
    let matchRes;
    while ((matchRes = matchFoodWithQuantity(workingText, item.regex, item))) {
      const mult = matchRes.multiplier;
      calories += item.cal * mult;
      protein += item.p * mult;
      carbs += item.c * mult;
      fat += item.f * mult;
      fiber += (item.fib || 0) * mult;
      sugar += (item.sug || 0) * mult;
      sodium += (item.sod || 0) * mult;
      potassium += (item.pot || 0) * mult;
      calcium += (item.calc || 0) * mult;
      iron += (item.fe || 0) * mult;
      vitaminC += (item.vitc || 0) * mult;
      detectedItems.push(matchRes.servingLabel);
      workingText = matchRes.newWorkingText;
    }
  }

  // Fallback balanced meal baseline if nothing matched
  if (calories === 0) {
    calories = 360;
    protein = 16;
    carbs = 48;
    fat = 12;
    fiber = 6;
    sugar = 4;
    sodium = 420;
    potassium = 380;
    calcium = 95;
    iron = 2.6;
    vitaminC = 12;
  }

  const cleanTitle = text.length > 55 ? text.slice(0, 52) + "…" : text;
  const formattedName = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);

  return {
    name: formattedName,
    servingLabel: detectedItems.length > 0 ? detectedItems.join(" + ") : "1 serving",
    calories: Math.round(calories),
    protein: Math.round(protein * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    fat: Math.round(fat * 10) / 10,
    fiber: Math.round(fiber * 10) / 10,
    sugar: Math.round(sugar * 10) / 10,
    sodium: Math.round(sodium),
    potassium: Math.round(potassium),
    calcium: Math.round(calcium),
    iron: Math.round(iron * 10) / 10,
    vitaminC: Math.round(vitaminC * 10) / 10,
    confidence: detectedItems.length > 0 ? "high" : "medium",
    notes: detectedItems.length > 0
      ? `Calculated from specified portions: ${detectedItems.join(", ")}.`
      : "Estimated from typical preparation, portion size, and standard ingredients.",
  };
}

function reconcileNutritionResult(res) {
  if (!res) return res;
  const p = Math.max(0, parseFloat(res.protein) || 0);
  const c = Math.max(0, parseFloat(res.carbs) || 0);
  const f = Math.max(0, parseFloat(res.fat) || 0);
  const macroCals = Math.round(p * 4 + c * 4 + f * 9);
  const rawCals = Math.round(parseFloat(res.calories) || 0);
  const finalCals = rawCals > 0 && Math.abs(rawCals - macroCals) <= Math.max(15, rawCals * 0.12) ? rawCals : macroCals;
  return {
    ...res,
    calories: Math.max(10, finalCals),
    protein: Math.round(p * 10) / 10,
    carbs: Math.round(c * 10) / 10,
    fat: Math.round(f * 10) / 10,
  };
}

/**
 * Natural Language AI Meal Analyzer
 */
/**
 * Natural Language AI Meal Analyzer
 */
export async function analyzeTextMeal(description, apiKey = "") {
  const text = (description || "").trim();
  if (!text) throw new Error("Please enter a description of what you ate.");

  const cleanKey = (apiKey || "").trim().replace(/^["']|["']$/g, "");

  // If no API key is provided, use the smart heuristic parser
  if (!cleanKey) {
    await new Promise((r) => setTimeout(r, 600));
    return reconcileNutritionResult(parseMealTextOffline(text));
  }

  // 1. Anthropic Claude (Keys starting with "sk-ant")
  if (cleanKey.startsWith("sk-ant")) {
    const claudeModels = ["claude-3-5-sonnet-20241022", "claude-3-7-sonnet-20250219", "claude-3-5-haiku-20241022"];
    for (const model of claudeModels) {
      try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": cleanKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          },
          body: JSON.stringify({
            model,
            max_tokens: 1000,
            messages: [
              {
                role: "user",
                content: `${TEXT_MEAL_PROMPT}\n\nUser meal description: "${text}"`,
              },
            ],
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const raw = (data.content || []).find((b) => b.type === "text")?.text;
          if (raw) {
            const clean = raw.replace(/```json|```/g, "").trim();
            return reconcileNutritionResult(JSON.parse(clean));
          }
        }
      } catch (err) {
        console.warn(`Claude text estimation (${model}) error:`, err);
      }
    }
    return reconcileNutritionResult(parseMealTextOffline(text));
  }

  // 2. OpenAI (Keys starting with "sk-")
  if (cleanKey.startsWith("sk-")) {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${cleanKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: TEXT_MEAL_PROMPT,
            },
            {
              role: "user",
              content: `User meal description: "${text}"`,
            },
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const raw = data?.choices?.[0]?.message?.content;
        if (raw) {
          const clean = raw.replace(/```json|```/g, "").trim();
          return reconcileNutritionResult(JSON.parse(clean));
        }
      }
    } catch (err) {
      console.warn("OpenAI text estimation error:", err);
    }
    return reconcileNutritionResult(parseMealTextOffline(text));
  }

  // 3. Google Gemini API
  const candidateModels = [
    "gemini-1.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-pro",
  ];

  for (const model of candidateModels) {
    for (const apiVersion of ["v1beta", "v1"]) {
      try {
        const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${cleanKey}`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `${TEXT_MEAL_PROMPT}\n\nUser meal description: "${text}"`,
                  },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: "application/json",
            },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const clean = rawText.replace(/```json|```/g, "").trim();
            return reconcileNutritionResult(JSON.parse(clean));
          }
        }
      } catch (err) {
        continue;
      }
    }
  }

  // Fallback to offline heuristic parser
  return reconcileNutritionResult(parseMealTextOffline(text));
}

/**
 * Image Analysis for Photos and Nutrition Labels
 */
export async function analyzeImage(base64, mediaType, kind, apiKey = "") {
  const cleanKey = (apiKey || "").trim().replace(/^["']|["']$/g, "");

  // Mode 1: No key entered -> instant sample preview
  if (!cleanKey) {
    await new Promise((r) => setTimeout(r, 700));
    if (kind === "photo") {
      return {
        name: "North Indian Thali (2 Rotis + Dal + Paneer + Rice)",
        servingLabel: "1 thali (~420g)",
        calories: 590,
        protein: 26,
        carbs: 72,
        fat: 22,
        fiber: 9.5,
        sugar: 4,
        sodium: 680,
        potassium: 540,
        calcium: 380,
        iron: 4.2,
        vitaminC: 18,
        confidence: "high",
        notes: "Balanced Indian thali with whole wheat rotis, dal tadka, paneer sabzi, and steamed rice.",
      };
    } else {
      return {
        productName: "Amul High Protein Greek Yogurt",
        servingLabel: "1 cup (100g)",
        calories: 90,
        protein: 15,
        carbs: 6,
        fat: 0.5,
        fiber: 0,
        sugar: 4,
        sodium: 45,
        saturatedFat: 0.2,
        potassium: 160,
        calcium: 220,
        iron: 0.1,
        vitaminC: 0,
        verdictLabel: "High Protein · Clean Macros",
        verdictScore: "green",
        reasons: [
          "High protein density (15g per 90 kcal)",
          "Zero added sugar & virtually fat free",
          "Rich in calcium and probiotics",
        ],
      };
    }
  }

  const prompt = kind === "photo" ? FOOD_PHOTO_PROMPT : LABEL_PHOTO_PROMPT;

  // 1. Anthropic Claude Vision (Keys starting with "sk-ant")
  if (cleanKey.startsWith("sk-ant")) {
    const claudeModels = ["claude-3-5-sonnet-20241022", "claude-3-7-sonnet-20250219", "claude-3-5-haiku-20241022"];
    let claudeError = null;
    for (const model of claudeModels) {
      try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": cleanKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          },
          body: JSON.stringify({
            model,
            max_tokens: 1000,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "image",
                    source: {
                      type: "base64",
                      media_type: mediaType || "image/jpeg",
                      data: base64,
                    },
                  },
                  { type: "text", text: prompt },
                ],
              },
            ],
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const raw = (data.content || []).find((b) => b.type === "text")?.text;
          if (raw) {
            const clean = raw.replace(/```json|```/g, "").trim();
            const parsed = JSON.parse(clean);
            return kind === "photo" ? reconcileNutritionResult(parsed) : parsed;
          }
        } else {
          const errData = await response.json().catch(() => ({}));
          claudeError = errData?.error?.message || `Claude HTTP ${response.status}`;
          if (response.status === 401) {
            throw new Error("Invalid Anthropic Claude API key. Please check your key in Settings.");
          }
          if (response.status === 429) {
            throw new Error("Anthropic API rate limit or credit quota exceeded.");
          }
        }
      } catch (err) {
        if (err.message.includes("Invalid Anthropic Claude API key") || err.message.includes("Anthropic API rate limit")) {
          throw err;
        }
        claudeError = err.message;
      }
    }
    throw new Error(`Claude Vision failed: ${claudeError || "Unknown error"}. Check API key and credits.`);
  }

  // 2. OpenAI Vision (Keys starting with "sk-" but not "sk-ant")
  if (cleanKey.startsWith("sk-")) {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${cleanKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mediaType || "image/jpeg"};base64,${base64}`,
                  },
                },
              ],
            },
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const raw = data?.choices?.[0]?.message?.content;
        if (raw) {
          const clean = raw.replace(/```json|```/g, "").trim();
          const parsed = JSON.parse(clean);
          return kind === "photo" ? reconcileNutritionResult(parsed) : parsed;
        }
      } else {
        const errData = await response.json().catch(() => ({}));
        const msg = errData?.error?.message || `OpenAI HTTP ${response.status}`;
        if (response.status === 401) {
          throw new Error("Invalid OpenAI API key. Please verify your API key in Settings.");
        }
        if (response.status === 429) {
          throw new Error("OpenAI quota exceeded. Check your OpenAI billing.");
        }
        throw new Error(`OpenAI Vision failed: ${msg}`);
      }
    } catch (err) {
      throw err;
    }
  }

  // 3. Google Gemini Vision (Default for AIzaSy... or standard Google AI Studio keys)
  const candidateModels = [
    "gemini-1.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-pro",
  ];

  let geminiLastError = null;

  for (const model of candidateModels) {
    for (const apiVersion of ["v1beta", "v1"]) {
      try {
        const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${cleanKey}`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  {
                    inlineData: {
                      mimeType: mediaType || "image/jpeg",
                      data: base64,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: "application/json",
            },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const clean = rawText.replace(/```json|```/g, "").trim();
            const parsed = JSON.parse(clean);
            return kind === "photo" ? reconcileNutritionResult(parsed) : parsed;
          }
        } else {
          const errData = await response.json().catch(() => ({}));
          const errMsg = errData?.error?.message || response.statusText || `HTTP ${response.status}`;
          geminiLastError = errMsg;
          console.warn(`Gemini model ${model} (${apiVersion}) failed:`, errMsg);

          if (response.status === 400 && (errMsg.includes("API key not valid") || errMsg.includes("API_KEY_INVALID"))) {
            throw new Error("Invalid Gemini API key. Please verify your key in Settings/Profile.");
          }
          if (response.status === 403) {
            throw new Error("Gemini API permission denied (403). Ensure Generative Language API is enabled for this key.");
          }
          if (response.status === 429) {
            throw new Error("Gemini API rate limit or quota exceeded (429). Please wait a moment.");
          }
        }
      } catch (err) {
        if (
          err.message.includes("Invalid Gemini API key") ||
          err.message.includes("Gemini API permission denied") ||
          err.message.includes("Gemini API rate limit")
        ) {
          throw err;
        }
        geminiLastError = err.message;
      }
    }
  }

  throw new Error(
    geminiLastError
      ? `AI Vision failed (${geminiLastError}). Check your API key or use manual logging.`
      : "Could not analyze image with current API key. Check connection or use manual logging."
  );
}
