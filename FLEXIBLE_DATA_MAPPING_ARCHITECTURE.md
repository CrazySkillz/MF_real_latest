# Flexible Data Mapping Architecture

## Overview
A comprehensive mapping system that allows users to connect Google Sheets or CSV files with any structure to MetricMind's required fields, with intelligent auto-detection and template support.

---

## 1. Core Components

### 1.1 Field Definition System

**Platform Field Registry**
```typescript
interface PlatformField {
  id: string;                    // e.g., "impressions", "revenue"
  name: string;                  // Display name: "Impressions"
  type: 'number' | 'text' | 'date' | 'currency' | 'percentage';
  required: boolean;              // Is this field mandatory?
  category: 'metrics' | 'dimensions' | 'identifiers'; // Grouping
  aliases: string[];             // Common alternative names
  patterns: RegExp[];            // Regex patterns for detection
  validation?: (value: any) => boolean;
  transform?: (value: any) => any; // Data transformation function
}

// Example field definitions
const LINKEDIN_REQUIRED_FIELDS: PlatformField[] = [
  {
    id: 'campaign_name',
    name: 'Campaign Name',
    type: 'text',
    required: true,
    category: 'identifiers',
    aliases: ['campaign', 'campaign name', 'campaign_name', 'ad campaign'],
    patterns: [/campaign.*name/i, /^campaign$/i]
  },
  {
    id: 'impressions',
    name: 'Impressions',
    type: 'number',
    required: true,
    category: 'metrics',
    aliases: ['impressions', 'views', 'imp', 'impression count'],
    patterns: [/impressions?/i, /^views?$/i]
  },
  {
    id: 'clicks',
    name: 'Clicks',
    type: 'number',
    required: true,
    category: 'metrics',
    aliases: ['clicks', 'click', 'click count', 'ctr clicks'],
    patterns: [/clicks?/i]
  },
  {
    id: 'spend',
    name: 'Spend (USD)',
    type: 'currency',
    required: true,
    category: 'metrics',
    aliases: ['spend', 'cost', 'budget', 'spent', 'cost (usd)', 'spend (usd)'],
    patterns: [/spend/i, /cost/i, /budget/i],
    transform: (val) => parseFloat(val.toString().replace(/[^0-9.-]/g, ''))
  },
  {
    id: 'conversions',
    name: 'Conversions',
    type: 'number',
    required: false,  // Optional for some platforms
    category: 'metrics',
    aliases: ['conversions', 'conversion', 'conversion count', 'conv'],
    patterns: [/conversions?/i]
  },
  {
    id: 'revenue',
    name: 'Revenue',
    type: 'currency',
    required: false,  // Optional - can be calculated
    category: 'metrics',
    aliases: ['revenue', 'sales', 'total revenue', 'revenue (usd)', 'income'],
    patterns: [/revenue/i, /sales/i, /income/i],
    transform: (val) => parseFloat(val.toString().replace(/[^0-9.-]/g, ''))
  }
];
```

### 1.2 Column Detection & Analysis

**Automatic Column Type Detection**
```typescript
interface DetectedColumn {
  index: number;
  name: string;
  originalName: string;
  detectedType: 'number' | 'text' | 'date' | 'currency' | 'percentage' | 'boolean' | 'unknown';
  confidence: number;           // 0-1, how confident we are in the type
  sampleValues: any[];          // First few non-empty values
  uniqueValues?: number;        // Count of unique values
  nullCount: number;             // How many empty/null values
  suggestedFieldId?: string;    // Auto-suggested platform field
  matchScore?: number;           // 0-1, how well it matches suggested field
}

function detectColumnTypes(rows: any[][]): DetectedColumn[] {
  const columns: DetectedColumn[] = [];
  const headerRow = rows[0];
  
  // Analyze each column
  for (let i = 0; i < headerRow.length; i++) {
    const columnName = headerRow[i]?.toString().trim() || `Column ${i + 1}`;
    const columnValues = rows.slice(1)
      .map(row => row[i])
      .filter(val => val !== null && val !== undefined && val !== '');
    
    const detectedType = inferType(columnValues);
    const confidence = calculateTypeConfidence(columnValues, detectedType);
    
    columns.push({
      index: i,
      name: normalizeColumnName(columnName),
      originalName: columnName,
      detectedType,
      confidence,
      sampleValues: columnValues.slice(0, 5),
      uniqueValues: new Set(columnValues).size,
      nullCount: rows.length - 1 - columnValues.length
    });
  }
  
  return columns;
}

function inferType(values: any[]): string {
  if (values.length === 0) return 'unknown';
  
  // Check for currency (has $, €, £, etc.)
  const currencyPattern = /^[\$€£¥]\s*\d+[.,]?\d*$/;
  if (values.some(v => currencyPattern.test(String(v)))) {
    return 'currency';
  }
  
  // Check for percentage
  const percentagePattern = /^\d+[.,]?\d*\s*%$/;
  if (values.some(v => percentagePattern.test(String(v)))) {
    return 'percentage';
  }
  
  // Check for dates
  const datePattern = /^\d{4}-\d{2}-\d{2}$|^\d{2}\/\d{2}\/\d{4}$/;
  if (values.some(v => datePattern.test(String(v)))) {
    return 'date';
  }
  
  // Check for numbers
  const numericValues = values.filter(v => !isNaN(parseFloat(String(v))));
  if (numericValues.length / values.length > 0.8) {
    return 'number';
  }
  
  // Check for boolean
  const booleanValues = values.filter(v => 
    ['true', 'false', 'yes', 'no', '1', '0'].includes(String(v).toLowerCase())
  );
  if (booleanValues.length / values.length > 0.8) {
    return 'boolean';
  }
  
  return 'text';
}
```

### 1.3 Intelligent Auto-Mapping

**Fuzzy Matching Algorithm**
```typescript
interface FieldMapping {
  sourceColumnIndex: number;
  sourceColumnName: string;
  targetFieldId: string;
  targetFieldName: string;
  matchType: 'auto' | 'manual' | 'template';
  confidence: number;
  transform?: (value: any) => any;
}

function autoMapColumns(
  detectedColumns: DetectedColumn[],
  platformFields: PlatformField[]
): FieldMapping[] {
  const mappings: FieldMapping[] = [];
  const usedFields = new Set<string>();
  
  for (const column of detectedColumns) {
    let bestMatch: { field: PlatformField; score: number } | null = null;
    
    // Try to match against each platform field
    for (const field of platformFields) {
      // Skip if field already mapped or not required and already have required fields
      if (usedFields.has(field.id)) continue;
      
      const score = calculateMatchScore(column, field);
      
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { field, score };
      }
    }
    
    // Only auto-map if confidence is high enough (e.g., > 0.6)
    if (bestMatch && bestMatch.score > 0.6) {
      mappings.push({
        sourceColumnIndex: column.index,
        sourceColumnName: column.originalName,
        targetFieldId: bestMatch.field.id,
        targetFieldName: bestMatch.field.name,
        matchType: 'auto',
        confidence: bestMatch.score,
        transform: bestMatch.field.transform
      });
      usedFields.add(bestMatch.field.id);
    }
  }
  
  return mappings;
}

function calculateMatchScore(
  column: DetectedColumn,
  field: PlatformField
): number {
  let score = 0;
  
  // 1. Exact name match (highest priority)
  if (column.originalName.toLowerCase() === field.name.toLowerCase()) {
    score += 0.5;
  }
  
  // 2. Alias match
  const normalizedColumnName = column.originalName.toLowerCase().trim();
  if (field.aliases.some(alias => 
    normalizedColumnName === alias.toLowerCase() ||
    normalizedColumnName.includes(alias.toLowerCase()) ||
    alias.toLowerCase().includes(normalizedColumnName)
  )) {
    score += 0.4;
  }
  
  // 3. Pattern match
  if (field.patterns.some(pattern => pattern.test(column.originalName))) {
    score += 0.3;
  }
  
  // 4. Type compatibility
  if (isTypeCompatible(column.detectedType, field.type)) {
    score += 0.2;
  } else {
    score -= 0.3; // Penalty for type mismatch
  }
  
  // 5. Fuzzy string similarity (Levenshtein distance)
  const similarity = stringSimilarity(
    normalizedColumnName,
    field.name.toLowerCase()
  );
  score += similarity * 0.2;
  
  return Math.min(1, Math.max(0, score));
}

function stringSimilarity(str1: string, str2: string): number {
  // Simplified Levenshtein distance
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}
```

---

## 2. User Interface Components

### 2.1 Mapping Interface Layout

```
┌─────────────────────────────────────────────────────────┐
│  Data Source Mapping                                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  📋 Uploaded Columns (5 columns detected)              │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Column Name        │ Type    │ Sample Values     │   │
│  ├──────────────────────────────────────────────────┤   │
│  │ Campaign Name      │ text    │ "Summer Sale"     │   │
│  │ Impressions        │ number  │ 12500            │   │
│  │ Clicks             │ number  │ 450              │   │
│  │ Cost               │ currency│ $1,250.00        │   │
│  │ Revenue            │ currency│ $5,000.00        │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  🎯 Required Fields (LinkedIn Ads)                       │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Field Name        │ Status  │ Mapped To          │   │
│  ├──────────────────────────────────────────────────┤   │
│  │ ✓ Campaign Name   │ ✅ Auto │ Campaign Name     │   │
│  │ ✓ Impressions      │ ✅ Auto │ Impressions       │   │
│  │ ✓ Clicks           │ ✅ Auto │ Clicks            │   │
│  │ ✓ Spend (USD)      │ ⚠️  Map │ [Select: Cost]    │   │
│  │ ○ Conversions      │ ⏸️  Skip │ (Optional)        │   │
│  │ ○ Revenue          │ ✅ Auto │ Revenue            │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  [🔄 Re-detect]  [💾 Save as Template]  [✅ Continue]    │
└─────────────────────────────────────────────────────────┘
```

### 2.2 UI Component Structure

```typescript
interface MappingUIProps {
  uploadedColumns: DetectedColumn[];
  platformFields: PlatformField[];
  initialMappings?: FieldMapping[];
  onMappingComplete: (mappings: FieldMapping[]) => void;
  onSaveTemplate?: (template: MappingTemplate) => void;
}

function MappingInterface({
  uploadedColumns,
  platformFields,
  initialMappings,
  onMappingComplete,
  onSaveTemplate
}: MappingUIProps) {
  const [mappings, setMappings] = useState<FieldMapping[]>(
    initialMappings || autoMapColumns(uploadedColumns, platformFields)
  );
  const [validationErrors, setValidationErrors] = useState<Map<string, string>>(new Map());
  
  // Validate mappings
  useEffect(() => {
    const errors = validateMappings(mappings, platformFields);
    setValidationErrors(errors);
  }, [mappings, platformFields]);
  
  const handleFieldMapping = (fieldId: string, columnIndex: number | null) => {
    setMappings(prev => {
      // Remove existing mapping for this field
      const filtered = prev.filter(m => m.targetFieldId !== fieldId);
      
      // Add new mapping if column selected
      if (columnIndex !== null) {
        const column = uploadedColumns.find(c => c.index === columnIndex);
        const field = platformFields.find(f => f.id === fieldId);
        
        if (column && field) {
          filtered.push({
            sourceColumnIndex: column.index,
            sourceColumnName: column.originalName,
            targetFieldId: field.id,
            targetFieldName: field.name,
            matchType: 'manual',
            confidence: 1.0,
            transform: field.transform
          });
        }
      }
      
      return filtered;
    });
  };
  
  return (
    <div className="mapping-interface">
      {/* Uploaded Columns Display */}
      <ColumnList columns={uploadedColumns} />
      
      {/* Required Fields with Mapping Controls */}
      <FieldMappingList
        fields={platformFields}
        mappings={mappings}
        uploadedColumns={uploadedColumns}
        onMappingChange={handleFieldMapping}
        validationErrors={validationErrors}
      />
      
      {/* Action Buttons */}
      <div className="mapping-actions">
        <Button onClick={handleReDetect}>🔄 Re-detect Columns</Button>
        <Button onClick={handleSaveTemplate}>💾 Save as Template</Button>
        <Button 
          onClick={() => onMappingComplete(mappings)}
          disabled={!isMappingValid(mappings, platformFields)}
        >
          ✅ Continue
        </Button>
      </div>
    </div>
  );
}
```

---

## 3. Template System

### 3.1 Template Storage

```typescript
interface MappingTemplate {
  id: string;
  name: string;
  description?: string;
  platform: string;              // e.g., "linkedin", "google_ads"
  columnStructure: {
    columnNames: string[];        // Expected column order/names
    columnTypes: string[];        // Expected types
  };
  mappings: FieldMapping[];
  createdAt: Date;
  lastUsedAt?: Date;
  usageCount: number;
  createdBy?: string;             // User ID
  isShared: boolean;               // Can others use this template?
}

// Store templates in database
const mappingTemplatesTable = pgTable("mapping_templates", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  platform: text("platform").notNull(),
  columnStructure: jsonb("column_structure").notNull(),
  mappings: jsonb("mappings").notNull(),
  createdAt: timestamp("created_at").notNull(),
  lastUsedAt: timestamp("last_used_at"),
  usageCount: integer("usage_count").default(0),
  createdBy: text("created_by"),
  isShared: boolean("is_shared").default(false)
});
```

### 3.2 Template Matching

```typescript
function findMatchingTemplates(
  uploadedColumns: DetectedColumn[],
  platform: string
): MappingTemplate[] {
  // Get all templates for this platform
  const templates = await storage.getMappingTemplates(platform);
  
  // Score each template based on column structure similarity
  const scoredTemplates = templates.map(template => {
    const score = calculateTemplateMatchScore(uploadedColumns, template);
    return { template, score };
  });
  
  // Sort by score and return top matches
  return scoredTemplates
    .filter(t => t.score > 0.5)  // Only return reasonably good matches
    .sort((a, b) => b.score - a.score)
    .map(t => t.template);
}

function calculateTemplateMatchScore(
  columns: DetectedColumn[],
  template: MappingTemplate
): number {
  const templateColumns = template.columnStructure.columnNames;
  const uploadedColumnNames = columns.map(c => c.name.toLowerCase());
  
  let matches = 0;
  for (const templateCol of templateColumns) {
    if (uploadedColumnNames.some(uploaded => 
      stringSimilarity(uploaded, templateCol.toLowerCase()) > 0.7
    )) {
      matches++;
    }
  }
  
  return matches / Math.max(templateColumns.length, uploadedColumnNames.length);
}
```

---

## 4. Data Transformation Pipeline

### 4.1 Transformation Engine

```typescript
interface TransformationResult {
  success: boolean;
  transformedRows: any[];
  errors: Array<{ row: number; field: string; error: string }>;
  warnings: Array<{ row: number; field: string; warning: string }>;
}

function transformData(
  rawRows: any[][],
  mappings: FieldMapping[],
  platformFields: PlatformField[]
): TransformationResult {
  const transformedRows: any[] = [];
  const errors: Array<{ row: number; field: string; error: string }> = [];
  const warnings: Array<{ row: number; field: string; warning: string }> = [];
  
  // Skip header row
  for (let rowIndex = 1; rowIndex < rawRows.length; rowIndex++) {
    const rawRow = rawRows[rowIndex];
    const transformedRow: any = {};
    
    // Apply each mapping
    for (const mapping of mappings) {
      const field = platformFields.find(f => f.id === mapping.targetFieldId);
      if (!field) continue;
      
      const rawValue = rawRow[mapping.sourceColumnIndex];
      
      try {
        // Apply transformation if defined
        let transformedValue = rawValue;
        if (mapping.transform) {
          transformedValue = mapping.transform(rawValue);
        } else if (field.transform) {
          transformedValue = field.transform(rawValue);
        }
        
        // Validate
        if (field.required && (transformedValue === null || transformedValue === undefined || transformedValue === '')) {
          errors.push({
            row: rowIndex + 1,
            field: field.name,
            error: `Required field "${field.name}" is missing or empty`
          });
          continue;
        }
        
        if (field.validation && !field.validation(transformedValue)) {
          errors.push({
            row: rowIndex + 1,
            field: field.name,
            error: `Invalid value for "${field.name}": ${transformedValue}`
          });
          continue;
        }
        
        // Type conversion
        transformedValue = convertToType(transformedValue, field.type);
        
        transformedRow[field.id] = transformedValue;
        
      } catch (error: any) {
        errors.push({
          row: rowIndex + 1,
          field: field.name,
          error: `Transformation error: ${error.message}`
        });
      }
    }
    
    // Check if all required fields are present
    const missingRequired = platformFields
      .filter(f => f.required && !transformedRow[f.id])
      .map(f => f.name);
    
    if (missingRequired.length > 0) {
      errors.push({
        row: rowIndex + 1,
        field: 'multiple',
        error: `Missing required fields: ${missingRequired.join(', ')}`
      });
    } else {
      transformedRows.push(transformedRow);
    }
  }
  
  return {
    success: errors.length === 0,
    transformedRows,
    errors,
    warnings
  };
}

function convertToType(value: any, targetType: string): any {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  switch (targetType) {
    case 'number':
      const num = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
      return isNaN(num) ? null : num;
    
    case 'currency':
      return parseFloat(String(value).replace(/[^0-9.-]/g, ''));
    
    case 'date':
      return parseDate(String(value));
    
    case 'percentage':
      return parseFloat(String(value).replace(/[^0-9.-]/g, '')) / 100;
    
    case 'boolean':
      const str = String(value).toLowerCase();
      return ['true', 'yes', '1', 'y'].includes(str);
    
    default:
      return String(value).trim();
  }
}
```

---

## 5. Multiple File Upload Support

### 5.1 File Management

```typescript
interface UploadedFile {
  id: string;
  name: string;
  type: 'google_sheets' | 'csv';
  spreadsheetId?: string;        // For Google Sheets
  fileContent?: string;          // For CSV
  detectedColumns: DetectedColumn[];
  mappings?: FieldMapping[];
  status: 'uploaded' | 'mapping' | 'mapped' | 'imported' | 'error';
  error?: string;
}

function handleMultipleFileUpload(files: File[]): Promise<UploadedFile[]> {
  return Promise.all(files.map(async (file) => {
    const content = await readFileContent(file);
    const rows = parseCSV(content);
    const detectedColumns = detectColumnTypes(rows);
    
    return {
      id: generateId(),
      name: file.name,
      type: 'csv',
      fileContent: content,
      detectedColumns,
      status: 'uploaded' as const
    };
  }));
}
```

### 5.2 Batch Mapping

```typescript
function batchMapFiles(
  files: UploadedFile[],
  platformFields: PlatformField[]
): UploadedFile[] {
  return files.map(file => {
    // Auto-map each file
    const mappings = autoMapColumns(file.detectedColumns, platformFields);
    
    return {
      ...file,
      mappings,
      status: mappings.length > 0 ? 'mapped' : 'mapping'
    };
  });
}
```

---

## 6. Implementation Phases

### Phase 1: Basic Mapping (MVP)
- ✅ Column detection
- ✅ Auto-mapping with fuzzy matching
- ✅ Manual mapping override
- ✅ Required field validation
- ✅ Data transformation

### Phase 2: Template System
- ✅ Save mapping templates
- ✅ Template matching and suggestions
- ✅ Template sharing

### Phase 3: Advanced Features
- ✅ Multiple file upload
- ✅ Column type detection improvements
- ✅ Custom transformations
- ✅ Mapping preview with sample data

### Phase 4: Intelligence
- ✅ Machine learning for better auto-mapping
- ✅ Pattern recognition across files
- ✅ Smart defaults based on industry/campaign type

---

## 7. Database Schema

```sql
-- Mapping Templates
CREATE TABLE mapping_templates (
  id VARCHAR PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  platform TEXT NOT NULL,
  column_structure JSONB NOT NULL,
  mappings JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL,
  last_used_at TIMESTAMP,
  usage_count INTEGER DEFAULT 0,
  created_by TEXT,
  is_shared BOOLEAN DEFAULT false
);

-- File Uploads (for tracking)
CREATE TABLE data_imports (
  id VARCHAR PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  column_mappings JSONB NOT NULL,
  status TEXT NOT NULL,
  imported_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP NOT NULL
);

-- Column Mappings (for audit trail)
CREATE TABLE column_mappings (
  id VARCHAR PRIMARY KEY,
  import_id VARCHAR REFERENCES data_imports(id),
  source_column_name TEXT NOT NULL,
  target_field_id TEXT NOT NULL,
  match_type TEXT NOT NULL, -- 'auto', 'manual', 'template'
  confidence DECIMAL(3,2),
  created_at TIMESTAMP NOT NULL
);
```

---

## 8. API Endpoints

```typescript
// Upload and detect columns
POST /api/data-import/upload
Body: { file: File, platform: string }
Response: { fileId: string, detectedColumns: DetectedColumn[] }

// Get platform fields
GET /api/platforms/:platform/fields
Response: { fields: PlatformField[] }

// Auto-map columns
POST /api/data-import/:fileId/auto-map
Body: { platform: string }
Response: { mappings: FieldMapping[] }

// Save mapping
POST /api/data-import/:fileId/mappings
Body: { mappings: FieldMapping[] }
Response: { success: boolean }

// Transform and import data
POST /api/data-import/:fileId/import
Body: { mappings: FieldMapping[], campaignId: string }
Response: { success: boolean, importedRows: number, errors: any[] }

// Save template
POST /api/mapping-templates
Body: { name: string, platform: string, mappings: FieldMapping[], columnStructure: any }
Response: { templateId: string }

// Get matching templates
GET /api/mapping-templates/match
Query: { platform: string, columnNames: string[] }
Response: { templates: MappingTemplate[] }
```

---

## 9. User Experience Flow

1. **Upload File(s)**
   - User uploads CSV or connects Google Sheet
   - System detects columns and types
   - Shows preview of detected structure

2. **Auto-Mapping**
   - System suggests mappings automatically
   - Highlights required vs optional fields
   - Shows confidence scores

3. **Manual Adjustment**
   - User can override auto-mappings
   - Dropdown to select from uploaded columns
   - Visual indicators for missing required fields

4. **Template Suggestions**
   - If similar file structure found, suggest template
   - User can apply template with one click

5. **Preview & Validate**
   - Show sample transformed data
   - Highlight validation errors
   - Allow fixing before import

6. **Save Template (Optional)**
   - User can save mapping for future use
   - Name and describe the template

7. **Import**
   - Transform data using mappings
   - Import into campaign
   - Show import summary with errors/warnings

---

## 10. Benefits

✅ **Flexibility**: Support any CSV/Sheet structure
✅ **Intelligence**: Auto-detect and suggest mappings
✅ **Efficiency**: Save time with templates
✅ **Accuracy**: Validation prevents bad data
✅ **Scalability**: Handle multiple files and platforms
✅ **User-Friendly**: Clear visual feedback and guidance

