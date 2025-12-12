# Implementation Plan: Dynamic Standardization Strategy

## Overview

This plan outlines the steps required to implement the dynamic standardization strategy for Google Sheets data processing to calculate conversion value for LinkedIn campaigns.

---

## Current State Analysis

### What Already Exists:
✅ Column detection (`column-detection.ts`)
✅ Basic auto-mapping (`auto-mapping.ts`)
✅ Data transformation (`data-transformation.ts`)
✅ Field definitions (`field-definitions.ts`)
✅ Basic filtering (`filterRowsByCampaignAndPlatform`)

### What Needs Enhancement:
⚠️ Schema discovery (needs pattern recognition)
⚠️ Semantic mapping (needs multi-level matching)
⚠️ Data enrichment (needs contextual inference)
⚠️ Format normalization (needs more format support)
⚠️ Canonical format (needs standardized output)

---

## Implementation Phases

### Phase 1: Enhanced Schema Discovery (Week 1)

**Goal**: Automatically detect dataset structure and patterns

**Tasks:**

1. **Create `server/utils/schema-discovery.ts`**
   ```typescript
   // New file
   export interface DatasetSchema {
     structure: {
       totalRows: number;
       totalColumns: number;
       columns: ColumnInfo[];
     };
     patterns: {
       isTimeSeries: boolean;
       isMultiPlatform: boolean;
       aggregationLevel: string;
       hasMissingValues: boolean;
     };
     quality: {
       duplicateRows: number;
       inconsistentFormats: string[];
       outliers: any[];
     };
   }
   
   export function discoverSchema(
     rawRows: any[][],
     detectedColumns: DetectedColumn[]
   ): DatasetSchema
   ```

2. **Enhance Column Detection**
   - Add pattern recognition (time-series detection)
   - Add data quality analysis (missing values, duplicates)
   - Add statistical analysis (outliers, distributions)

3. **Add Pattern Detection Functions**
   ```typescript
   function detectTimeSeries(rows: any[], dateColumnIndex: number): boolean
   function detectMultiPlatform(rows: any[], platformColumnIndex: number): boolean
   function detectAggregationLevel(rows: any[]): string
   function analyzeDataQuality(rows: any[]): QualityMetrics
   ```

4. **Update `detect-columns` API Endpoint**
   - Call schema discovery after column detection
   - Return schema metadata along with columns
   - Include pattern information in response

**Files to Create/Modify:**
- ✅ Create: `server/utils/schema-discovery.ts`
- ✅ Modify: `server/utils/column-detection.ts` (if exists)
- ✅ Modify: `server/routes-oauth.ts` (detect-columns endpoint)

**Testing:**
- Test with time-series data
- Test with multi-platform data
- Test with missing values
- Test with inconsistent formats

---

### Phase 2: Enhanced Semantic Mapping (Week 1-2)

**Goal**: Improve auto-mapping with semantic understanding

**Tasks:**

1. **Enhance `server/utils/auto-mapping.ts`**
   - Add semantic concept mapping
   - Add multi-level matching (name + pattern + context + statistics)
   - Add confidence scoring improvements

2. **Create Semantic Concept Mapper**
   ```typescript
   // Add to auto-mapping.ts
   interface SemanticConcept {
     id: string;
     name: string;
     aliases: string[];
     patterns: RegExp[];
     dataPatterns: {
       type: string;
       characteristics: string[];
     };
   }
   
   function mapToSemanticConcept(
     column: DetectedColumn,
     concepts: SemanticConcept[]
   ): { concept: SemanticConcept; confidence: number }
   ```

3. **Add Contextual Analysis**
   ```typescript
   function analyzeColumnContext(
     column: DetectedColumn,
     allColumns: DetectedColumn[],
     sampleRows: any[][]
   ): ContextAnalysis
   
   function calculateContextualScore(
     column: DetectedColumn,
     field: PlatformField,
     context: ContextAnalysis
   ): number
   ```

4. **Enhance Match Score Calculation**
   - Add pattern-based scoring
   - Add statistical scoring
   - Add contextual scoring
   - Combine all scores for final confidence

5. **Update Auto-Mapping UI**
   - Show confidence scores in UI
   - Show match reasons (why system matched)
   - Show alternative suggestions

**Files to Create/Modify:**
- ✅ Modify: `server/utils/auto-mapping.ts`
- ✅ Modify: `client/src/components/ColumnMappingInterface.tsx`

**Testing:**
- Test with non-standard column names
- Test with ambiguous columns
- Test confidence scoring accuracy
- Test UI display of confidence

---

### Phase 3: Enhanced Data Transformation (Week 2)

**Goal**: Handle any data format variation

**Tasks:**

1. **Enhance `server/utils/data-transformation.ts`**
   - Expand format support (more currency formats, date formats)
   - Add normalization functions
   - Add format detection

2. **Create Normalization Functions**
   ```typescript
   // Add to data-transformation.ts
   function normalizeText(value: any): string
   function normalizeCurrency(value: any): number
   function normalizeDate(value: any): string  // ISO format
   function normalizePlatform(value: any): string  // Canonical ID
   function normalizeCampaignName(value: any): string
   ```

3. **Expand Format Support**
   ```typescript
   // Currency formats
   "$5,000.00" → 5000.00
   "5,000" → 5000.00
   "5.000,50" (European) → 5000.50
   "5 000" (French) → 5000.00
   
   // Date formats
   "2024-01-15" → "2024-01-15"
   "Jan 15, 2024" → "2024-01-15"
   "15/01/2024" → "2024-01-15"
   "01-15-2024" → "2024-01-15"
   // ... more formats
   ```

4. **Update `convertToType` Function**
   - Add more format patterns
   - Add format detection before conversion
   - Add error handling for edge cases

5. **Add Format Detection**
   ```typescript
   function detectCurrencyFormat(value: any): CurrencyFormat
   function detectDateFormat(value: any): DateFormat
   function detectNumberFormat(value: any): NumberFormat
   ```

**Files to Create/Modify:**
- ✅ Modify: `server/utils/data-transformation.ts`
- ✅ Create: `server/utils/normalization.ts` (optional, can be in data-transformation.ts)

**Testing:**
- Test all currency formats
- Test all date formats
- Test edge cases (empty, null, invalid)
- Test international formats

---

### Phase 4: Contextual Enrichment (Week 2-3)

**Goal**: Fill missing data intelligently using context

**Tasks:**

1. **Create `server/utils/data-enrichment.ts`**
   ```typescript
   // New file
   export interface EnrichmentContext {
     campaign: {
       id: string;
       name: string;
       platform: string;
     };
     dataset: {
       schema: DatasetSchema;
       patterns: PatternAnalysis;
     };
   }
   
   export function enrichRowData(
     row: any,
     mappings: FieldMapping[],
     context: EnrichmentContext
   ): any
   ```

2. **Implement Enrichment Rules**
   ```typescript
   // Platform enrichment
   if (!row.platform && context.campaign.platform) {
     row.platform = context.campaign.platform;
   }
   
   // Date enrichment (for time-series)
   if (!row.date && isTimeSeries) {
     row.date = inferDateFromSequence(rowIndex, previousDate);
   }
   
   // Campaign name enrichment
   if (!row.campaign_name && row.campaign_id) {
     row.campaign_name = extractCampaignName(row.campaign_id);
   }
   ```

3. **Add Inference Functions**
   ```typescript
   function inferPlatformFromCampaign(context: EnrichmentContext): string | null
   function inferDateFromSequence(
     rowIndex: number,
     previousDate: string | null,
     isTimeSeries: boolean
   ): string | null
   function extractCampaignName(campaignId: string): string
   ```

4. **Integrate with Transformation Pipeline**
   - Call enrichment after transformation
   - Apply enrichment rules based on context
   - Log enrichment actions for transparency

**Files to Create/Modify:**
- ✅ Create: `server/utils/data-enrichment.ts`
- ✅ Modify: `server/utils/data-transformation.ts` (integrate enrichment)
- ✅ Modify: `server/routes-oauth.ts` (use enrichment in processing)

**Testing:**
- Test platform inference
- Test date inference
- Test campaign name extraction
- Test with various missing data scenarios

---

### Phase 5: Enhanced Dynamic Filtering (Week 3)

**Goal**: Improve filtering with fuzzy matching and context-awareness

**Tasks:**

1. **Enhance `server/utils/data-transformation.ts`**
   - Improve `filterRowsByCampaignAndPlatform` function
   - Add fuzzy campaign name matching
   - Add platform inference logic
   - Add quality-based filtering

2. **Add Fuzzy Matching**
   ```typescript
   function normalizeCampaignName(name: string): string {
     return name
       .toLowerCase()
       .trim()
       .replace(/\s+/g, ' ')
       .replace(/[_-]/g, ' ');
   }
   
   function fuzzyMatchCampaignName(
     rowName: string,
     campaignName: string,
     threshold: number = 0.8
   ): boolean
   ```

3. **Enhance Platform Filtering**
   ```typescript
   function filterByPlatform(
     rows: any[],
     campaignPlatform: string,
     platformColumnMapped: boolean
   ): any[] {
     if (platformColumnMapped) {
       // Filter by platform column
       return rows.filter(row => 
         normalizePlatform(row.platform) === normalizePlatform(campaignPlatform)
       );
     } else {
       // No platform column - assume all rows are for campaign's platform
       return rows;
     }
   }
   ```

4. **Add Quality-Based Filtering**
   ```typescript
   function filterByQuality(
     rows: any[],
     minConfidence: number = 0.7
   ): any[]
   ```

5. **Update Filtering Logic in Processing**
   - Use enhanced filtering in conversion value calculation
   - Add logging for filtered rows
   - Provide feedback about filtering results

**Files to Create/Modify:**
- ✅ Modify: `server/utils/data-transformation.ts`
- ✅ Modify: `server/routes-oauth.ts` (use enhanced filtering)

**Testing:**
- Test fuzzy campaign name matching
- Test platform filtering with/without Platform column
- Test quality-based filtering
- Test edge cases (empty, null, variations)

---

### Phase 6: Canonical Format Creation (Week 3-4)

**Goal**: Create standardized output format

**Tasks:**

1. **Create `server/utils/canonical-format.ts`**
   ```typescript
   // New file
   export interface CanonicalDataset {
     metadata: {
       source: string;
       processedAt: string;
       originalStructure: any;
       transformations: TransformationLog[];
       quality: QualityMetrics;
     };
     rows: CanonicalRow[];
     aggregated: AggregatedMetrics;
   }
   
   export function createCanonicalFormat(
     transformedRows: any[],
     metadata: ProcessingMetadata
   ): CanonicalDataset
   ```

2. **Define Canonical Schema**
   ```typescript
   interface CanonicalRow {
     // Core identifiers
     campaign_identifier: string;
     platform_identifier: string;
     
     // Metrics
     revenue: number;
     conversions: number | null;
     
     // Dimensions
     date?: string;
     time_period?: string;
     
     // Metadata
     _original: any;
     _confidence: number;
     _source_row: number;
   }
   ```

3. **Create Aggregation Functions**
   ```typescript
   function aggregateMetrics(rows: CanonicalRow[]): AggregatedMetrics {
     return {
       total_revenue: sum(rows.map(r => r.revenue)),
       row_count: rows.length,
       date_range: getDateRange(rows),
       quality_metrics: calculateQuality(rows)
     };
   }
   ```

4. **Integrate with Processing Pipeline**
   - Convert transformed rows to canonical format
   - Store canonical format in processing
   - Use canonical format for conversion value calculation

**Files to Create/Modify:**
- ✅ Create: `server/utils/canonical-format.ts`
- ✅ Modify: `server/routes-oauth.ts` (use canonical format)

**Testing:**
- Test canonical format creation
- Test aggregation functions
- Test metadata preservation
- Test with various dataset structures

---

### Phase 7: UI Enhancements (Week 4)

**Goal**: Update UI to show dynamic standardization features

**Tasks:**

1. **Update `ColumnMappingInterface.tsx`**
   - Show confidence scores for auto-mappings
   - Show match reasons (why system matched)
   - Show data quality indicators
   - Show processing status

2. **Add Schema Discovery Display**
   ```typescript
   // Show detected patterns
   {schema.patterns.isMultiPlatform && (
     <Alert>
       Multi-platform dataset detected. Platform column will be used for filtering.
     </Alert>
   )}
   ```

3. **Add Confidence Indicators**
   ```typescript
   // Show confidence badges
   {mapping.confidence > 0.9 && <Badge>High Confidence</Badge>}
   {mapping.confidence > 0.7 && mapping.confidence <= 0.9 && <Badge>Medium Confidence</Badge>}
   {mapping.confidence <= 0.7 && <Badge>Low Confidence - Review</Badge>}
   ```

4. **Add Processing Feedback**
   - Show "Analyzing dataset..." during schema discovery
   - Show "Mapping columns..." during semantic mapping
   - Show "Processing data..." during transformation
   - Show results summary after processing

5. **Add Data Preview**
   - Show sample values for each column
   - Show normalized values after transformation
   - Show filtered rows count

**Files to Create/Modify:**
- ✅ Modify: `client/src/components/ColumnMappingInterface.tsx`
- ✅ Modify: `client/src/components/GoogleSheetsDatasetsView.tsx` (optional)

**Testing:**
- Test UI with various confidence levels
- Test UI with different dataset patterns
- Test processing feedback
- Test data preview

---

### Phase 8: Integration & Testing (Week 4-5)

**Goal**: Integrate all components and test end-to-end

**Tasks:**

1. **Integration Testing**
   - Test complete flow: Connect → Map → Process → Calculate
   - Test with various dataset formats
   - Test with edge cases
   - Test error handling

2. **Performance Testing**
   - Test with large datasets (1000+ rows)
   - Test with multiple sheets
   - Test processing speed
   - Optimize if needed

3. **User Acceptance Testing**
   - Test with real-world datasets
   - Test with different users
   - Gather feedback
   - Iterate based on feedback

4. **Documentation**
   - Update API documentation
   - Update user guide
   - Document new features
   - Document edge cases

**Files to Create/Modify:**
- ✅ Create: Test files for each phase
- ✅ Update: Documentation files
- ✅ Update: README if needed

**Testing:**
- End-to-end testing
- Performance testing
- User acceptance testing
- Edge case testing

---

## Implementation Checklist

### Phase 1: Schema Discovery
- [ ] Create `schema-discovery.ts`
- [ ] Add pattern detection functions
- [ ] Update `detect-columns` endpoint
- [ ] Test pattern detection
- [ ] Test data quality analysis

### Phase 2: Semantic Mapping
- [ ] Enhance auto-mapping with semantic concepts
- [ ] Add contextual analysis
- [ ] Improve confidence scoring
- [ ] Update UI to show confidence
- [ ] Test semantic mapping

### Phase 3: Data Transformation
- [ ] Add normalization functions
- [ ] Expand format support
- [ ] Add format detection
- [ ] Update `convertToType` function
- [ ] Test all format variations

### Phase 4: Contextual Enrichment
- [ ] Create `data-enrichment.ts`
- [ ] Implement enrichment rules
- [ ] Add inference functions
- [ ] Integrate with pipeline
- [ ] Test enrichment logic

### Phase 5: Dynamic Filtering
- [ ] Add fuzzy matching
- [ ] Enhance platform filtering
- [ ] Add quality-based filtering
- [ ] Update filtering logic
- [ ] Test filtering scenarios

### Phase 6: Canonical Format
- [ ] Create `canonical-format.ts`
- [ ] Define canonical schema
- [ ] Create aggregation functions
- [ ] Integrate with pipeline
- [ ] Test canonical format

### Phase 7: UI Enhancements
- [ ] Update ColumnMappingInterface
- [ ] Add confidence indicators
- [ ] Add processing feedback
- [ ] Add data preview
- [ ] Test UI updates

### Phase 8: Integration & Testing
- [ ] End-to-end testing
- [ ] Performance testing
- [ ] User acceptance testing
- [ ] Documentation updates
- [ ] Final polish

---

## File Structure

```
server/
├── utils/
│   ├── schema-discovery.ts          [NEW]
│   ├── data-enrichment.ts           [NEW]
│   ├── canonical-format.ts           [NEW]
│   ├── normalization.ts              [NEW - optional]
│   ├── auto-mapping.ts              [ENHANCE]
│   ├── data-transformation.ts       [ENHANCE]
│   └── field-definitions.ts         [ENHANCE - if needed]

client/src/components/
├── ColumnMappingInterface.tsx       [ENHANCE]
└── GoogleSheetsDatasetsView.tsx      [ENHANCE - optional]

server/routes-oauth.ts                [ENHANCE - multiple endpoints]
```

---

## Dependencies

### Phase Dependencies:
1. **Phase 1** (Schema Discovery) → No dependencies
2. **Phase 2** (Semantic Mapping) → Depends on Phase 1
3. **Phase 3** (Data Transformation) → No dependencies (can parallel with Phase 2)
4. **Phase 4** (Enrichment) → Depends on Phase 1, 3
5. **Phase 5** (Filtering) → Depends on Phase 3
6. **Phase 6** (Canonical Format) → Depends on Phase 3, 4, 5
7. **Phase 7** (UI) → Depends on Phase 1, 2, 6
8. **Phase 8** (Testing) → Depends on all phases

### Recommended Order:
1. Phase 1 (Schema Discovery) - Foundation
2. Phase 3 (Data Transformation) - Core functionality
3. Phase 2 (Semantic Mapping) - Can work in parallel with Phase 3
4. Phase 4 (Enrichment) - Builds on Phase 1, 3
5. Phase 5 (Filtering) - Builds on Phase 3
6. Phase 6 (Canonical Format) - Combines all previous
7. Phase 7 (UI) - User-facing
8. Phase 8 (Testing) - Final validation

---

## Estimated Timeline

- **Week 1**: Phase 1 (Schema Discovery) + Phase 3 (Data Transformation)
- **Week 2**: Phase 2 (Semantic Mapping) + Phase 4 (Enrichment)
- **Week 3**: Phase 5 (Filtering) + Phase 6 (Canonical Format)
- **Week 4**: Phase 7 (UI) + Phase 8 (Testing Part 1)
- **Week 5**: Phase 8 (Testing Part 2) + Documentation + Polish

**Total: 5 weeks**

---

## Success Criteria

### Technical:
- ✅ System handles any dataset format
- ✅ Auto-mapping accuracy > 90% for standard formats
- ✅ Processing time < 5 seconds for 1000 rows
- ✅ Zero data loss during transformation
- ✅ Accurate conversion value calculation

### User Experience:
- ✅ User can connect any Google Sheet format
- ✅ System auto-maps columns intelligently
- ✅ User sees confidence scores and can adjust
- ✅ Processing is transparent (user sees what's happening)
- ✅ Conversion value calculated accurately

### Quality:
- ✅ Comprehensive test coverage (>80%)
- ✅ Handles all edge cases
- ✅ Clear error messages
- ✅ Performance optimized
- ✅ Well documented

---

## Risk Mitigation

### Risk 1: Performance Issues
**Mitigation**: 
- Optimize algorithms
- Add caching where appropriate
- Process in batches for large datasets
- Add performance monitoring

### Risk 2: Mapping Accuracy
**Mitigation**:
- Start with high-confidence mappings
- Allow user override
- Provide clear feedback
- Learn from user corrections

### Risk 3: Format Compatibility
**Mitigation**:
- Support most common formats first
- Add format detection
- Provide clear error messages for unsupported formats
- Allow manual format specification

### Risk 4: Data Quality Issues
**Mitigation**:
- Validate data early
- Provide quality indicators
- Warn users about issues
- Allow data cleaning before processing

---

## Next Steps

1. **Review this plan** with team
2. **Prioritize phases** based on business needs
3. **Set up development environment**
4. **Start with Phase 1** (Schema Discovery)
5. **Iterate based on feedback**

---

## Summary

**Implementation requires:**
1. ✅ **6 new utility files** (schema discovery, enrichment, canonical format, etc.)
2. ✅ **3 enhanced existing files** (auto-mapping, data-transformation, field-definitions)
3. ✅ **2 UI component updates** (ColumnMappingInterface, GoogleSheetsDatasetsView)
4. ✅ **Multiple API endpoint updates** (detect-columns, save-mappings, data processing)
5. ✅ **Comprehensive testing** (unit, integration, user acceptance)
6. ✅ **Documentation** (API, user guide, technical docs)

**Timeline: 5 weeks**

**Result**: System can process any Google Sheet format and calculate conversion value accurately for LinkedIn campaigns! 🎯

