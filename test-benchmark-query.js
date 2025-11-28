// Test the exact query that the backend uses
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://mf_db_pjsn_user:zSdfB0AuPeDicWXzjfIaaii01cKrel8C@dpg-d4b0ndre5dus73f77obg-a.oregon-postgres.render.com/mf_db_pjsn',
  ssl: { rejectUnauthorized: false }
});

async function testQuery() {
  try {
    const campaignId = '9f9dfca6-bf5f-4598-85bf-826bdf890428'; // test3 campaign
    
    console.log(`\n🔍 Testing query for campaign: ${campaignId}\n`);
    
    // This is the EXACT query from getCampaignBenchmarks
    const result = await pool.query(`
      SELECT *
      FROM benchmarks
      WHERE (
        -- Global benchmarks created in this campaign
        (campaign_id = $1 AND (apply_to = 'all' OR specific_campaign_id IS NULL))
        OR
        -- Campaign-specific benchmarks targeting this campaign
        specific_campaign_id = $1
      )
      ORDER BY category, name;
    `, [campaignId]);
    
    console.log(`✅ Query returned ${result.rows.length} benchmarks:\n`);
    
    result.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.name}`);
      console.log(`   ID: ${row.id}`);
      console.log(`   Metric: ${row.metric}`);
      console.log(`   Campaign ID: ${row.campaign_id}`);
      console.log(`   Apply To: ${row.apply_to}`);
      console.log(`   Specific Campaign ID: ${row.specific_campaign_id}`);
      console.log('');
    });
    
    // Now create a test benchmark
    console.log('\n🔧 Creating a test campaign-specific benchmark...\n');
    
    const testBenchmark = await pool.query(`
      INSERT INTO benchmarks (
        campaign_id,
        platform_type,
        category,
        name,
        metric,
        description,
        benchmark_value,
        current_value,
        unit,
        benchmark_type,
        apply_to,
        specific_campaign_id,
        status
      ) VALUES (
        $1,
        'linkedin',
        'performance',
        'TEST Campaign Specific CTR',
        'ctr',
        'Test benchmark for specific campaign',
        2.5,
        0,
        '%',
        'industry',
        'specific',
        $1,
        'active'
      )
      RETURNING *;
    `, [campaignId]);
    
    console.log('✅ Created test benchmark:');
    console.log(JSON.stringify(testBenchmark.rows[0], null, 2));
    
    // Query again
    console.log('\n🔍 Querying again after creation...\n');
    
    const result2 = await pool.query(`
      SELECT *
      FROM benchmarks
      WHERE (
        (campaign_id = $1 AND (apply_to = 'all' OR specific_campaign_id IS NULL))
        OR
        specific_campaign_id = $1
      )
      ORDER BY category, name;
    `, [campaignId]);
    
    console.log(`✅ Query now returns ${result2.rows.length} benchmarks\n`);
    
    result2.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.name}`);
      console.log(`   Apply To: ${row.apply_to}`);
      console.log(`   Specific Campaign ID: ${row.specific_campaign_id}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

testQuery();

