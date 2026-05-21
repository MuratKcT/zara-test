# zara-test

Test suite for the **Zara AI Smile Design** n8n webhook workflow.

## Quick start

```bash
cp .env.example .env   # set ZARA_WEBHOOK_URL if different
npm install
npm test               # runs all scenarios
```

## Scenarios

| Command | What it tests |
|---------|--------------|
| `npm run test:text`    | Text-only message, no image, no patient data |
| `npm run test:patient` | Text + `[ДАНІ ПАЦІЄНТА]` block (name/phone/email) |
| `npm run test:image`   | Text + patient data + base64 JPEG image |
| `npm run test:all`     | All of the above |

### Image test setup

```bash
# Copy any JPEG to the samples folder and set the path in .env
cp ~/some-smile.jpg samples/test-smile.jpg
echo "TEST_IMAGE_PATH=./samples/test-smile.jpg" >> .env
npm run test:image
```

## Browser UI

Open `index.html` directly in a browser (no server needed).  
Supports drag-and-drop image upload, shows parsed results and AI-generated smile preview.

## Expected response shape

```json
{
  "success": true,
  "design": {
    "image_validation": { "is_valid": true, "quality": "good" },
    "current_smile_assessment": {
      "color_grade": "A3",
      "alignment": "good",
      "symmetry": "good",
      "overall_score": 7,
      "key_concerns": []
    },
    "design_style": "NATURAL",
    "patient_view": {
      "title": "...",
      "summary": "...",
      "recommended_services": ["veneers"],
      "expected_result": "...",
      "estimated_price_range": "від 8000 грн",
      "price_link": { "text": "Прайс", "url": "https://vashausmishka.com/tsiny" },
      "transformation_steps": ["...", "...", "..."]
    },
    "doctor_view": {
      "clinical_findings": "...",
      "recommended_procedures": [],
      "recommended_specialists": ["Dr. Name"],
      "treatment_complexity": "medium",
      "treatment_duration": "2-4 тижні"
    }
  },
  "generated_image_base64": "..."
}
```

## Known issues

| # | Node | Issue |
|---|------|-------|
| 1 | `Edit an image` | Crashes when request has no image — `onError` not set |
| 2 | `Merge_Zara` | `parameters: {}` — combine mode not explicitly configured |
| 3 | `Sheets_Zara` | Writes to `UmiData` sheet (copy-paste from Umi workflow) |
| 4 | `Upload_Drive_Zara` | Uploads original photo, not AI-edited image |
