export interface TechMetrics {
  avgCallbackRate: number;
  avgRating: number;
  emergencyResponseCount: number;
}

export type TechStatus = "available" | "on_job" | "en_route" | "off_duty" | "sick";
export type Seniority = "junior" | "mid" | "senior";

export interface Tech {
  id: string;
  name: string;
  seniority: Seniority;
  years: number;
  specialties: string[];
  certifications: string[];
  currentLocation: string;
  status: TechStatus;
  currentJobId: number | null;
  notes: string;
  metrics: TechMetrics;
}

export interface Complaint {
  date: string;
  issue: string;
  resolution: string;
  techId: string;
}

export type CommunicationPreference = "call" | "text";
export type PaymentHistory = "excellent" | "good" | "slow" | "disputed";

export interface Customer {
  id: string;
  name: string;
  address: string;
  phone: string;
  customerSince: string | null;
  tier: 1 | 2 | 3;
  lifetimeValue: number;
  jobCount: number;
  referralCount: number;
  notes: string;
  complaintHistory: Complaint[];
  lastJobDate: string | null;
  lastJobType: string | null;
  communicationPreference: CommunicationPreference;
  paymentHistory: PaymentHistory;
}

export type JobStatus = "scheduled" | "in_progress" | "completed" | "rescheduled" | "paused" | "cancelled";

export interface ScheduledJob {
  id: number;
  techId: string;
  time: string;
  durationHrs: number;
  type: string;
  customerId: string;
  address: string;
  status: JobStatus;
  notes: string;
  bumpable: boolean;
}

export type FlexSlotStatus = "available" | "consumed";

export interface FlexSlot {
  id: string;
  tech: string | null;
  time: string;
  duration_hrs: number;
  type: "FLEX_BUFFER";
  status: FlexSlotStatus;
  notes: string;
}

export interface Schedule {
  date: string;
  jobs: ScheduledJob[];
  flexSlots: FlexSlot[];
}

export interface ServiceCatalogEntry {
  type: string;
  priceRange: [number, number];
  durationRange: [number, number];
  minSeniority: Seniority | "any";
  requiredCerts: string[];
}

export interface JobsCatalog {
  emergency: ServiceCatalogEntry[];
  routine: ServiceCatalogEntry[];
  afterHoursSurcharge: number;
}

export interface DriveTimeEntry {
  from: string;
  to: string;
  minutes: number;
}

export interface Policies {
  warranty: { standardDays: number; description: string };
  callbacks: { withinWarranty: string; outsideWarranty: string };
  afterHours: { hours: string; surcharge: number };
  cancellation: { notice: string; fee: number; lateCancel: string };
  payment: { terms: string; methods: string[]; netTermsForCommercial: number };
  emergencyResponse: { guarantee: string; dispatchTarget: string };
}
