/* =====================================================================
   Client-side validation.
   Mirrors supabase/functions/_shared/validation.ts and the CHECK
   constraints in schema.sql. The server remains the authority — this
   layer exists purely for fast, friendly feedback (§42).
   ===================================================================== */
window.DS = window.DS || {};

(function (DS) {
  "use strict";

  DS.DISTRICTS = {
    "TamilNadu": ["Chennai"],
    "Andhra Pradesh": ["Vishak", "Vijayawada"],
  };

  DS.MAX_FILE_BYTES = 10 * 1024 * 1024;
  DS.ALLOWED_EXT = ["pdf", "jpg", "jpeg"];
  DS.ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/jpg"];

  const DIGITS = /^[0-9]+$/;
  const TEN_DIGITS = /^[0-9]{10}$/;
  const GMAIL = /^[a-z0-9]+([._%+-][a-z0-9]+)*@gmail\.com$/;

  /** Whole-year age from the real birth date — never year arithmetic alone. */
  DS.calcAge = function (isoDate, today) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate || "")) return NaN;
    const [y, m, d] = isoDate.split("-").map(Number);
    const now = today || new Date();
    let age = now.getFullYear() - y;
    const monthDiff = now.getMonth() + 1 - m;
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < d)) age--;
    return age;
  };

  /* ---------------- field-level rules ------------------------------ */
  const RULES = {
    unique_id_type: (v) => (!v ? "Please select the type of unique ID." : null),

    id_proof: (v) => {
      if (!v) return "Please enter your ID number.";
      if (!DIGITS.test(v)) return "Digits only — no spaces, dashes or letters.";
      if (v.length < 4) return "Please enter the full ID number.";
      return null;
    },

    first_name: (v) => (!v.trim() ? "Please enter your first name." : null),
    last_name: (v) => (!v.trim() ? "Please enter your last name." : null),

    date_of_birth: (v) => {
      if (!v) return "Please enter your date of birth.";
      const age = DS.calcAge(v);
      if (isNaN(age)) return "Please enter a valid date of birth.";
      if (age < 18 || age > 36) return "Beneficiary must be between 18 and 36 years of age.";
      return null;
    },

    gender: (v) => (!v ? "Please select your gender." : null),
    beneficiary_state: (v) => (!v ? "Please select your state." : null),

    district: (v, form) => {
      if (!v) return "Please select a district.";
      const state = form.beneficiary_state || "";
      if (!(DS.DISTRICTS[state] || []).includes(v)) {
        return "Please select a district that belongs to the selected state.";
      }
      return null;
    },

    contact_number: (v) => {
      if (!v) return "Please enter your contact number.";
      if (!TEN_DIGITS.test(v)) return "Please enter a valid 10-digit mobile number.";
      return null;
    },

    email: (v) => {
      if (!v) return "Please enter your email id.";
      if (v !== v.toLowerCase()) return "Email must be a lowercase Gmail address.";
      if (!GMAIL.test(v)) return "Email must be a lowercase Gmail address (example: dhanabal@gmail.com).";
      return null;
    },

    ews_category: (v) => (!v ? "Please answer the EWS question." : null),
    last_completed_education: (v) => (!v ? "Please select your last completed education." : null),
    degree_specialization: (v) => (!v ? "Please select your degree / specialization." : null),
    annual_income: (v) => (!v ? "Please select your annual income bracket." : null),
    occupation: (v) => (!v ? "Please select your occupation." : null),

    institution_type: (v, form) => {
      if (form.occupation !== "4-Student") return null;      // not applicable
      return !v ? "Please select the type of institution." : null;
    },

    domain_course: (v) => (!v ? "Please select a domain course." : null),
    pwd_status: (v) => (!v ? "Please answer the disability question." : null),
    parent_name: (v) => (!v.trim() ? "Please enter the name of the parent." : null),

    alternative_contact_number: (v) => {
      if (!v) return "Please enter an alternative contact number.";
      if (!TEN_DIGITS.test(v)) return "Please enter a valid 10-digit mobile number.";
      return null;
    },

    social_category: (v) => (!v ? "Please select your social category." : null),
  };

  DS.validateValue = function (name, value, form) {
    const rule = RULES[name];
    return rule ? rule(value == null ? "" : String(value), form || {}) : null;
  };

  /** File rules: extension + declared MIME + size (§8.3, §48, §71). */
  DS.validateFile = function (file, required) {
    if (!file) return required ? "Please upload this document." : null;

    const ext = DS.extensionOf(file.name);
    if (!DS.ALLOWED_EXT.includes(ext)) return "Please upload a PDF or JPG file.";

    const mime = (file.type || "").toLowerCase();
    if (mime && !DS.ALLOWED_MIME.includes(mime)) return "Please upload a PDF or JPG file.";

    if (file.size <= 0) return "That file appears to be empty.";
    if (file.size > DS.MAX_FILE_BYTES) return "File size must not exceed 10 MB.";
    return null;
  };

  /* ---------------- DOM error rendering ---------------------------- */
  DS.fieldEl = (name) => document.querySelector(`[data-field="${name}"]`);

  DS.setFieldError = function (name, message) {
    const wrap = DS.fieldEl(name);
    if (!wrap) return;
    wrap.classList.add("is-invalid");
    const err = wrap.querySelector(".ds-error span");
    if (err) err.textContent = message;
    const input = wrap.querySelector("input, select, textarea");
    if (input) input.setAttribute("aria-invalid", "true");
  };

  DS.clearFieldError = function (name) {
    const wrap = DS.fieldEl(name);
    if (!wrap) return;
    wrap.classList.remove("is-invalid");
    const input = wrap.querySelector("input, select, textarea");
    if (input) input.removeAttribute("aria-invalid");
  };

  DS.clearAllErrors = function () {
    document.querySelectorAll(".ds-field.is-invalid").forEach((el) => {
      el.classList.remove("is-invalid");
      const input = el.querySelector("input, select, textarea");
      if (input) input.removeAttribute("aria-invalid");
    });
  };

  DS.focusFirstError = function () {
    const first = document.querySelector(".ds-field.is-invalid");
    if (!first) return;
    const input = first.querySelector("input, select, textarea");
    first.scrollIntoView({ behavior: "smooth", block: "center" });
    if (input && !input.disabled) setTimeout(() => input.focus({ preventScroll: true }), 320);
  };
})(window.DS);
