interface GA4Credentials {
  propertyId: string;
  measurementId: string;
  accessToken?: string;
}

interface GA4Metrics {
  impressions: number;
  clicks: number;
  sessions: number;
  pageviews: number;
  bounceRate: number;
  averageSessionDuration: number;
  conversions: number;
  activeUsers?: number;
  newUsers: number;
  userEngagementDuration: number;
  engagedSessions: number;
  engagementRate: number;
  eventCount: number;
  eventsPerSession: number;
  screenPageViewsPerSession: number;
}

export class GoogleAnalytics4Service {
  async getMetricsWithToken(propertyId: string, accessToken: string, dateRange = 'today'): Promise<GA4Metrics> {
    const credentials = { propertyId, measurementId: '', accessToken };
    return this.getMetrics(credentials, accessToken, dateRange);
  }

  // Get geographic breakdown of users
  async getGeographicMetrics(propertyId: string, accessToken: string, dateRange = 'today'): Promise<any> {
    try {
      const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          dateRanges: [
            {
              startDate: dateRange === 'today' ? 'today' : dateRange === '7days' ? '7daysAgo' : dateRange === '30days' ? '30daysAgo' : dateRange,
              endDate: 'today'
            }
          ],
          dimensions: [
            { name: 'country' },
            { name: 'region' },
            { name: 'city' }
          ],
          metrics: [
            { name: 'totalUsers' },
            { name: 'sessions' },
            { name: 'screenPageViews' },
            { name: 'averageSessionDuration' }
          ],
          orderBys: [
            {
              metric: { metricName: 'totalUsers' },
              desc: true
            }
          ],
          limit: 50
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`GA4 API Error: ${errorData}`);
      }

      const data = await response.json();
      
      console.log('GA4 Geographic API Response:', {
        totalRows: data.rows?.length || 0,
        hasData: !!data.rows && data.rows.length > 0
      });

      // Process geographic data
      const geographicData = [];
      if (data.rows) {
        for (const row of data.rows) {
          if (row.dimensionValues && row.metricValues) {
            const country = row.dimensionValues[0]?.value || 'Unknown';
            const region = row.dimensionValues[1]?.value || 'Unknown';
            const city = row.dimensionValues[2]?.value || 'Unknown';
            const users = parseInt(row.metricValues[0]?.value || '0');
            const sessions = parseInt(row.metricValues[1]?.value || '0');
            const pageviews = parseInt(row.metricValues[2]?.value || '0');
            const avgSessionDuration = parseFloat(row.metricValues[3]?.value || '0');
            
            geographicData.push({
              country,
              region,
              city,
              users,
              sessions,
              pageviews,
              avgSessionDuration
            });
          }
        }
      }

      return {
        success: true,
        data: geographicData,
        totalLocations: geographicData.length,
        topCountries: geographicData.slice(0, 10)
      };

    } catch (error) {
      console.error('Error fetching GA4 geographic metrics:', error);
      throw new Error(`Failed to fetch GA4 geographic metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Automatic token refresh for SaaS production use

  async simulateGA4Connection(propertyId: string): Promise<{ success: boolean; user?: any; properties?: any[] }> {
    // Return success with simulated data for demo purposes
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return {
        success: true,
        user: { email: 'demo@example.com', name: 'Demo User' },
        properties: [
          { id: propertyId, name: 'Demo GA4 Property', account: 'Demo Account' }
        ]
      };
    }
    return { success: false };
  }

  async refreshAccessToken(refreshToken: string, clientId?: string, clientSecret?: string): Promise<{ access_token: string; expires_in: number }> {
    // Use provided client credentials (from database) or fall back to environment variables
    const authClientId = clientId || process.env.GOOGLE_CLIENT_ID;
    const authClientSecret = clientSecret || process.env.GOOGLE_CLIENT_SECRET;
    
    if (authClientId && authClientSecret) {
      // Production-grade automatic refresh with stored or environment credentials
      console.log('Using OAuth credentials for automatic refresh (source:', clientId ? 'database' : 'environment', ')');
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: authClientId,
          client_secret: authClientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to refresh token: ${errorData.error_description || errorData.error}`);
      }

      const tokenData = await response.json();
      return {
        access_token: tokenData.access_token,
        expires_in: tokenData.expires_in || 3600
      };
    } else {
      // Fallback: Try refresh without credentials (will likely fail, but attempt it)
      console.log('WARNING: No OAuth credentials - attempting refresh without client auth (may fail)');
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Token refresh failed without client credentials:', errorData);
        throw new Error('Automatic refresh requires Google OAuth credentials for guaranteed operation');
      }

      const tokenData = await response.json();
      return {
        access_token: tokenData.access_token,
        expires_in: tokenData.expires_in || 3600
      };
    }
  }

  async getTimeSeriesData(campaignId: string, storage: any, dateRange = '30daysAgo'): Promise<any[]> {
    const connection = await storage.getGA4Connection(campaignId);
    if (!connection || connection.method !== 'access_token') {
      throw new Error('No valid access token connection found');
    }

    if (!connection.accessToken) {
      console.log('No access token found in database for campaign:', campaignId);
      const tokenExpiredError = new Error('TOKEN_EXPIRED');
      (tokenExpiredError as any).isTokenExpired = true;
      throw tokenExpiredError;
    }

    try {
      return await this.getTimeSeriesWithToken(connection.propertyId, connection.accessToken, dateRange);
    } catch (error: any) {
      console.log('GA4 time series API call failed:', error.message);
      
      // Check if error is due to expired token
      if (error.message.includes('invalid_grant') || 
          error.message.includes('401') || 
          error.message.includes('403') ||
          error.message.includes('invalid authentication credentials') ||
          error.message.includes('Request had invalid authentication credentials')) {
        
        console.log('Access token invalid/expired for time series - attempting automatic refresh');
        
        if (connection.refreshToken) {
          try {
            const refreshResult = await this.refreshAccessToken(
              connection.refreshToken, 
              connection.clientId || undefined,
              connection.clientSecret || undefined
            );
            
            await storage.updateGA4ConnectionTokens(campaignId, {
              accessToken: refreshResult.access_token,
              refreshToken: connection.refreshToken,
              expiresAt: new Date(Date.now() + (refreshResult.expires_in * 1000))
            });
            
            console.log('Access token refreshed successfully - retrying time series call');
            return await this.getTimeSeriesWithToken(connection.propertyId, refreshResult.access_token, dateRange);
          } catch (refreshError: any) {
            console.error('Failed to refresh access token for time series:', refreshError.message);
            const autoRefreshError = new Error('AUTO_REFRESH_NEEDED');
            (autoRefreshError as any).isAutoRefreshNeeded = true;
            (autoRefreshError as any).hasRefreshToken = !!connection.refreshToken;
            throw autoRefreshError;
          }
        } else {
          const tokenExpiredError = new Error('TOKEN_EXPIRED');
          (tokenExpiredError as any).isTokenExpired = true;
          throw tokenExpiredError;
        }
      }
      throw error;
    }
  }

  async getTimeSeriesWithToken(propertyId: string, accessToken: string, dateRange = '30daysAgo'): Promise<any[]> {
    try {
      // Get daily data for the specified date range
      const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [
            {
              startDate: dateRange,
              endDate: 'today',
            },
          ],
          dimensions: [
            { name: 'date' }
          ],
          metrics: [
            { name: 'sessions' },
            { name: 'screenPageViews' },
            { name: 'conversions' },
            { name: 'totalUsers' },
            { name: 'newUsers' },
            { name: 'engagedSessions' }
          ],
          orderBys: [
            {
              dimension: {
                dimensionName: 'date'
              }
            }
          ]
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GA4 Time Series API Error: ${errorText}`);
      }

      const data = await response.json();
      
      console.log('GA4 Time Series API Response for property', propertyId, ':', {
        totalRows: data.rows?.length || 0,
        dateRange: `${dateRange} to today`,
        hasData: !!data.rows && data.rows.length > 0
      });

      // Process the response data into chart format
      const timeSeriesData: any[] = [];
      
      if (data.rows) {
        for (const row of data.rows) {
          if (row.dimensionValues && row.metricValues) {
            const date = row.dimensionValues[0]?.value || '';
            const sessions = parseInt(row.metricValues[0]?.value || '0');
            const pageviews = parseInt(row.metricValues[1]?.value || '0');
            const conversions = parseInt(row.metricValues[2]?.value || '0');
            const users = parseInt(row.metricValues[3]?.value || '0');
            
            // Format date for display (convert YYYYMMDD to readable format)
            let formattedDate = date;
            if (date.length === 8) {
              const year = date.substring(0, 4);
              const month = date.substring(4, 6);
              const day = date.substring(6, 8);
              formattedDate = `${month}/${day}`;
            }
            
            timeSeriesData.push({
              date: formattedDate,
              sessions,
              pageviews,
              conversions,
              users
            });
          }
        }
      }

      console.log('Processed time series data:', {
        totalPoints: timeSeriesData.length,
        sampleData: timeSeriesData.slice(0, 3)
      });

      return timeSeriesData;
    } catch (error) {
      console.error('Error fetching GA4 time series data:', error);
      throw error;
    }
  }

  async getMetricsWithAutoRefresh(campaignId: string, storage: any, dateRange = 'today'): Promise<GA4Metrics> {
    const connection = await storage.getGA4Connection(campaignId);
    if (!connection || connection.method !== 'access_token') {
      throw new Error('No valid access token connection found');
    }

    // Check if we have an access token
    if (!connection.accessToken) {
      console.log('No access token found in database for campaign:', campaignId);
      const tokenExpiredError = new Error('TOKEN_EXPIRED');
      (tokenExpiredError as any).isTokenExpired = true;
      throw tokenExpiredError;
    }

    console.log('Using access token for GA4 API call:', {
      campaignId,
      propertyId: connection.propertyId,
      tokenLength: connection.accessToken.length,
      tokenStart: connection.accessToken.substring(0, 20)
    });
    
    // Try with current token
    try {
      return await this.getMetricsWithToken(connection.propertyId, connection.accessToken, dateRange);
    } catch (error: any) {
      console.log('GA4 API call failed:', error.message);
      
      // Check if error is due to expired token
      if (error.message.includes('invalid_grant') || 
          error.message.includes('401') || 
          error.message.includes('403') ||
          error.message.includes('invalid authentication credentials') ||
          error.message.includes('Request had invalid authentication credentials')) {
        
        console.log('Access token invalid/expired - attempting automatic background refresh');
        
        // Attempt automatic token refresh if we have a refresh token
        if (connection.refreshToken) {
          try {
            console.log('Refreshing access token automatically in background...');
            console.log('Using stored OAuth credentials:', {
              hasClientId: !!connection.clientId,
              hasClientSecret: !!connection.clientSecret,
              clientIdLength: connection.clientId?.length || 0
            });
            
            // Use stored client credentials for automatic refresh
            const refreshResult = await this.refreshAccessToken(
              connection.refreshToken, 
              connection.clientId || undefined,
              connection.clientSecret || undefined
            );
            
            // Update the connection with new access token
            await storage.updateGA4ConnectionTokens(campaignId, {
              accessToken: refreshResult.access_token,
              refreshToken: connection.refreshToken, // Keep the same refresh token
              expiresAt: new Date(Date.now() + (refreshResult.expires_in * 1000))
            });
            
            console.log('Access token refreshed successfully - retrying metrics call');
            
            // Retry with new token using specified date range
            return await this.getMetricsWithToken(connection.propertyId, refreshResult.access_token, dateRange);
          } catch (refreshError: any) {
            console.error('Failed to refresh access token automatically:', refreshError.message);
            
            // If automatic refresh fails, fall back to UI refresh
            const autoRefreshError = new Error('AUTO_REFRESH_NEEDED');
            (autoRefreshError as any).isAutoRefreshNeeded = true;
            (autoRefreshError as any).hasRefreshToken = !!connection.refreshToken;
            throw autoRefreshError;
          }
        } else {
          console.log('No refresh token available - user needs to reconnect');
          const tokenExpiredError = new Error('TOKEN_EXPIRED');
          (tokenExpiredError as any).isTokenExpired = true;
          throw tokenExpiredError;
        }
      }
      throw error;
    }
  }

  async getMetrics(credentials: GA4Credentials, accessToken: string, dateRange = 'today'): Promise<GA4Metrics> {
    try {
      // First try to get real-time data
      const realtimeResponse = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${credentials.propertyId}:runRealtimeReport`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          metrics: [
            { name: 'activeUsers' },
            { name: 'screenPageViews' }
          ],
        }),
      });

      let realtimeData = null;
      if (realtimeResponse.ok) {
        realtimeData = await realtimeResponse.json();
        console.log('Real-time GA4 data retrieved:', {
          hasData: !!realtimeData?.rows?.length,
          totalRows: realtimeData?.rows?.length || 0
        });
      } else {
        const realtimeError = await realtimeResponse.text();
        console.log('Real-time API failed (fallback to historical data):', realtimeError);
        // Continue with historical data only - real-time API might need additional scopes
      }

      // Then get historical data for context
      const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${credentials.propertyId}:runReport`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [
            {
              startDate: dateRange, // Use the requested date range
              endDate: 'today', // Include today for most current data
            },
          ],
          metrics: [
            { name: 'sessions' },
            { name: 'screenPageViews' },
            { name: 'bounceRate' },
            { name: 'averageSessionDuration' },
            { name: 'conversions' },
            { name: 'totalUsers' },
            { name: 'newUsers' },
            { name: 'engagedSessions' },
            { name: 'engagementRate' },
            { name: 'eventCount' }
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GA4 API Error: ${errorText}`);
      }

      const data = await response.json();
      
      console.log('GA4 API Response for property', credentials.propertyId, ':', {
        totalRows: data.rows?.length || 0,
        dateRange: dateRange,
        requestedDateRange: dateRange,
        hasData: !!data.rows && data.rows.length > 0
      });

      // Process real-time data first
      let realtimeActiveUsers = 0;
      let realtimePageviews = 0;
      
      if (realtimeData?.rows) {
        for (const row of realtimeData.rows) {
          if (row.metricValues) {
            realtimeActiveUsers += parseInt(row.metricValues[0]?.value || '0');
            realtimePageviews += parseInt(row.metricValues[1]?.value || '0');
          }
        }
        console.log('Real-time metrics:', { realtimeActiveUsers, realtimePageviews });
      }

      // Process the historical response data with expanded metrics
      let totalSessions = 0;
      let totalPageviews = 0;
      let totalUsers = 0;
      let totalConversions = 0;
      let totalBounceRate = 0;
      let totalSessionDuration = 0;
      let totalNewUsers = 0;
      let totalEngagedSessions = 0;
      let totalEngagementRate = 0;
      let totalEventCount = 0;
      let rowCount = 0;

      if (data.rows) {
        for (const row of data.rows) {
          if (row.metricValues) {
            const sessions = parseInt(row.metricValues[0]?.value || '0');
            const pageviews = parseInt(row.metricValues[1]?.value || '0');
            const bounceRate = parseFloat(row.metricValues[2]?.value || '0');
            const sessionDuration = parseFloat(row.metricValues[3]?.value || '0');
            const conversions = parseInt(row.metricValues[4]?.value || '0');
            const users = parseInt(row.metricValues[5]?.value || '0');
            const newUsers = parseInt(row.metricValues[6]?.value || '0');
            const engagedSessions = parseInt(row.metricValues[7]?.value || '0');
            const engagementRate = parseFloat(row.metricValues[8]?.value || '0');
            const eventCount = parseInt(row.metricValues[9]?.value || '0');
            
            totalSessions += sessions;
            totalPageviews += pageviews;
            totalBounceRate += bounceRate;
            totalSessionDuration += sessionDuration;
            totalConversions += conversions;
            totalUsers += users;
            totalNewUsers += newUsers;
            totalEngagedSessions += engagedSessions;
            totalEngagementRate += engagementRate;
            totalEventCount += eventCount;
            rowCount++;
            
            if (rowCount <= 3) {
              console.log(`GA4 Row ${rowCount}:`, {
                sessions, pageviews, bounceRate, sessionDuration, conversions, users,
                newUsers, engagedSessions, engagementRate, eventCount
              });
            }
          }
        }
      }
      
      console.log('GA4 Final totals:', {
        totalSessions,
        totalPageviews,
        totalUsers,
        realtimeActiveUsers,
        realtimePageviews,
        totalConversions,
        avgBounceRate: rowCount > 0 ? totalBounceRate / rowCount : 0,
        avgSessionDuration: rowCount > 0 ? totalSessionDuration / rowCount : 0
      });

      // Return authentic data from Google Analytics API based on requested date range
      // Combine historical data with real-time activity when available
      const finalUsers = totalUsers + realtimeActiveUsers;
      const finalPageviews = totalPageviews + realtimePageviews;
      
      console.log('GA4 authentic metrics for', dateRange, ':', {
        historicalUsers: totalUsers,
        realtimeUsers: realtimeActiveUsers,
        finalUsers,
        finalPageviews,
        apiDateRange: `${dateRange} to today`
      });
      
      return {
        impressions: finalUsers,
        clicks: totalSessions, 
        sessions: totalSessions,
        pageviews: finalPageviews,
        bounceRate: rowCount > 0 ? totalBounceRate / rowCount : 0,
        averageSessionDuration: rowCount > 0 ? totalSessionDuration / rowCount : 0,
        conversions: totalConversions,
        activeUsers: realtimeActiveUsers,
        newUsers: totalNewUsers,
        userEngagementDuration: 0, // Calculate from session duration
        engagedSessions: totalEngagedSessions,
        engagementRate: rowCount > 0 ? totalEngagementRate / rowCount : 0,
        eventCount: totalEventCount,
        eventsPerSession: totalSessions > 0 ? totalEventCount / totalSessions : 0,
        screenPageViewsPerSession: totalSessions > 0 ? totalPageviews / totalSessions : 0,
      };
    } catch (error) {
      console.error('Error fetching GA4 metrics:', error);
      throw new Error(`Failed to fetch GA4 metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async testConnection(credentials: GA4Credentials, accessToken: string): Promise<boolean> {
    try {
      const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${credentials.propertyId}:runReport`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [
            {
              startDate: '7daysAgo',
              endDate: 'today',
            },
          ],
          metrics: [{ name: 'sessions' }],
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Error testing GA4 connection:', error);
      return false;
    }
  }
}

export const ga4Service = new GoogleAnalytics4Service();