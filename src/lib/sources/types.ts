// Shared shapes for every lead source.

export interface DiscoveredLead {
  businessName: string;
  contactName?: string | null;
  website?: string | null;
  email?: string | null;
  instagram?: string | null;
  linkedin?: string | null;
  twitter?: string | null;
  whatsapp?: string | null;
  location?: string | null;
  industry?: string | null;
  sourceType: string; // OVERPASS | REDDIT | RSS | PASTE | MANUAL
  sourceUrl?: string | null;
  painPoint?: string | null;
  /** Free text used for keyword + service matching during ingest. */
  rawText?: string | null;
}

export interface IngestResult {
  leadId: string;
  businessName: string;
  created: boolean; // true = new lead, false = matched an existing one (deduped)
}
