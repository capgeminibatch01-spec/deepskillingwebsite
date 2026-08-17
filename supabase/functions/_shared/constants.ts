// Shared option domains + file rules.
// These mirror css/js validation on the client AND the CHECK constraints
// in schema.sql. Three layers, one source of truth per layer.

export const BUCKET = "deep-skilling-documents";
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB (§48)

export const OPTIONS = {
  unique_id_type: [
    "PAN Card",
    "Electoral Card",
    "Driving License",
    "College ID",
    "School 10th / 12th Marksheet",
  ],
  gender: ["Male", "Female", "Third Gender", "Prefer Not to Say"],
  beneficiary_state: ["TamilNadu", "Andhra Pradesh"],
  ews_category: ["Yes - 1", "No - 2"],
  last_completed_education: [
    "1-Not completed formal education",
    "2-Completed 12th",
    "3-Diploma/ITI",
    "4-Graduation",
    "5-Post Graduation & above",
    "6-None of the above",
  ],
  degree_specialization: [
    "B.A.", "B.Sc.", "B.Com.", "B.Tech/B.E.", "BCA",
    "M.A.", "M.Sc.", "MBA", "M.Tech", "Diploma", "ITI",
  ],
  annual_income: [
    "1-Less than 99,999",
    "2-1 to 2.99 Lakh",
    "3-3 to 4.99 Lakh",
    "4-5 to 7.99 Lakh",
    "5-Above 8 Lakh",
  ],
  occupation: [
    "1-Employed", "2-Unemployed", "3-Entrepreneur", "4-Student", "5-Unpaid work",
  ],
  institution_type: ["1-School", "2-University", "3-ITI", "4-NGO Centre", "5-None"],
  domain_course: ["Data Analytics", "Artificial Intelligence", "Cyber Security"],
  pwd_status: ["Yes - 1", "No - 2"],
  social_category: ["SC-1", "ST-2", "OBC-3", "Gen-4", "Prefer not to say-5"],
} as const;

export const DISTRICTS: Record<string, string[]> = {
  "TamilNadu": ["Chennai"],
  "Andhra Pradesh": ["Vishak", "Vijayawada"],
};

export const DOC_KINDS = ["education", "ews", "pwd"] as const;
export type DocKind = typeof DOC_KINDS[number];

export const DOC_LABELS: Record<DocKind, string> = {
  education: "Educational Document",
  ews: "EWS Certificate",
  pwd: "PWD Certificate",
};

export const ALLOWED_EXTENSIONS = ["pdf", "jpg", "jpeg"];
export const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/jpg"];
