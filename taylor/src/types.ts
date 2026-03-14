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
  serviceHistory: ServiceEvent[];
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

// --- Reminder types ---

export interface ReminderCreator {
  role: "customer" | "ops" | "tech" | "ceo" | "system";
  id: string; // customer ID, tech ID, or "blake" / "ceo"
}

export type ReminderTargetChannel = "customer" | "ops" | "tech" | "ceo";

export interface ReminderRecurrence {
  interval: "daily" | "weekly" | "monthly" | "yearly" | "custom";
  customDays?: number;
  endAfter?: string; // ISO date to stop recurring, or null for indefinite
}

export type ReminderStatus = "active" | "triggered" | "snoozed" | "cancelled";

export interface Reminder {
  id: string;
  createdAt: string;
  createdBy: ReminderCreator;
  targetChannel: ReminderTargetChannel;
  targetId?: string; // customer ID or tech ID if channel-specific
  triggerAt: string; // ISO datetime for next notification
  recurrence?: ReminderRecurrence;
  message: string; // what to tell the user
  context: string; // why this reminder exists (for agent reasoning)
  status: ReminderStatus;
  snoozedUntil?: string;
  jobId?: string;
  customerId?: string;
}

// --- Service event types ---

export type ServiceEventType =
  | "intake"
  | "dispatch"
  | "tech_assigned"
  | "schedule_change"
  | "tech_update"
  | "completion"
  | "feedback"
  | "complaint"
  | "resolution"
  | "follow_up"
  | "note"
  | "warranty_claim"
  | "referral"
  | "communication";

export type ServiceEventChannel = "customer" | "ops" | "tech" | "system";
export type Sentiment = "positive" | "neutral" | "negative" | "distressed";

export interface ServiceEvent {
  id: string;
  timestamp: string;
  type: ServiceEventType;
  channel: ServiceEventChannel;
  summary: string;
  details?: string;
  techId?: string;
  jobType?: string;
  resolution?: string;
  sentiment?: Sentiment;
  agentReasoning?: string;
}
