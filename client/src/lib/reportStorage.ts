// Simple localStorage-based report storage for demo purposes
// In production, this would be handled by the backend/database

export interface StoredReport {
  id: string;
  name: string;
  type: string;
  status: 'Generated' | 'Scheduled' | 'Failed';
  campaignId?: string;
  campaignName?: string;
  generatedAt: Date;
  format: string;
  size?: string;
  includeKPIs?: boolean;
  includeBenchmarks?: boolean;
  schedule?: {
    frequency: string;
    day: string;
    time: string;
    recipients: string[];
  } | null;
  downloadUrl?: string; // For actual file downloads in production
}

const STORAGE_KEY = 'marketpulse_reports';

export const reportStorage = {
  // Get all stored reports
  getReports(): StoredReport[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      
      const reports = JSON.parse(stored);
      // Convert date strings back to Date objects
      return reports.map((report: any) => ({
        ...report,
        generatedAt: new Date(report.generatedAt)
      }));
    } catch (error) {
      console.error('Error loading reports:', error);
      return [];
    }
  },

  // Add a new report
  addReport(report: Omit<StoredReport, 'id'>): StoredReport {
    try {
      const reports = this.getReports();
      const newReport: StoredReport = {
        ...report,
        id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };
      
      reports.unshift(newReport); // Add to beginning
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
      
      return newReport;
    } catch (error) {
      console.error('Error saving report:', error);
      throw error;
    }
  },

  // Update a report
  updateReport(id: string, updates: Partial<StoredReport>): void {
    try {
      const reports = this.getReports();
      const index = reports.findIndex(r => r.id === id);
      
      if (index !== -1) {
        reports[index] = { ...reports[index], ...updates };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
      }
    } catch (error) {
      console.error('Error updating report:', error);
    }
  },

  // Delete a report
  deleteReport(id: string): void {
    try {
      const reports = this.getReports();
      const filtered = reports.filter(r => r.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error deleting report:', error);
    }
  },

  // Get reports for a specific campaign
  getCampaignReports(campaignId: string): StoredReport[] {
    return this.getReports().filter(r => r.campaignId === campaignId);
  },

  // Get scheduled reports only
  getScheduledReports(): StoredReport[] {
    return this.getReports().filter(r => r.status === 'Scheduled' && r.schedule);
  }
};