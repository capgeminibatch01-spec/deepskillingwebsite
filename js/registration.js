/* =====================================================================
   Public registration form controller.
   ===================================================================== */
(function (DS) {
  "use strict";

  const FIELDS = [
    "unique_id_type", "id_proof", "first_name", "last_name", "date_of_birth",
    "gender", "beneficiary_state", "district", "contact_number", "email",
    "ews_category", "last_completed_education", "degree_specialization",
    "annual_income", "occupation", "institution_type", "domain_course",
    "pwd_status", "parent_name", "alternative_contact_number", "social_category",
  ];

    const FILE_FIELDS = {
    education: { input: "education_file", field: "education_file",
                 required: () => val("last_completed_education") !== "1-Not completed formal education" },
    ews:       { input: "ews_file",       field: "ews_file",       required: () => true },
    pwd:       { input: "pwd_file",       field: "pwd_file",
                 required: () => val("pwd_status") === "Yes - 1" },
  };

  let isSubmitting = false;
  let isLocked = false;

  const $ = (id) => document.getElementById(id);
  const val = (id) => ($(id) ? $(id).value.trim() : "");

  /* ------------------------------------------------------------------ */
  /* Boot                                                                */
  /* ------------------------------------------------------------------ */
  document.addEventListener("DOMContentLoaded", function () {
    if (!DS.configReady) {
      DS.showBanner("formBanner",
        "This site is not configured yet. Please contact the programme administrator.", true);
      $("submitBtn").disabled = true;
      return;
    }

        setDobBounds();
    wireStateDistrict();
    wireIdProof();
    wireEducation();
    wireOccupation();
    wirePwd();
    wireFiles();
    wireLiveValidation();
    wireSubmit();
    updateProgress();

    checkMaintenance();
    setInterval(checkMaintenance, 20000);
  });

  /* ------------------------------------------------------------------ */
  /* Date of birth bounds (also enforced by validation + server)         */
  /* ------------------------------------------------------------------ */
  function setDobBounds() {
    const dob = $("date_of_birth");
    if (!dob) return;
    const today = new Date();
    const iso = (d) => d.toISOString().slice(0, 10);

    const latest = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
    const earliest = new Date(today.getFullYear() - 37, today.getMonth(), today.getDate() + 1);

    dob.max = iso(latest);
    dob.min = iso(earliest);
  }

  /* ------------------------------------------------------------------ */
  /* State → District (§7.8)                                             */
  /* ------------------------------------------------------------------ */
    function wireStateDistrict() {
    const state = $("beneficiary_state");
    const district = $("district");
    const stateList = $("beneficiary_state_list");
    const districtList = $("district_list");
    // Populate the state/UT typeahead once, on load.
    stateList.innerHTML = DS.STATES.map((name) => `<option value="${name}"></option>`).join("");
    function syncDistrictOptions() {
      const options = DS.DISTRICTS[state.value] || [];
      districtList.innerHTML = options.map((name) => `<option value="${name}"></option>`).join("");
      district.disabled = options.length === 0;
      district.placeholder = options.length ? "Start typing a district" : "Select a state first";
    }
    // "input" fires on every keystroke, so a district list refreshes as
    // soon as a full, valid state name is typed — not only on blur/change.
    state.addEventListener("input", function () {
      // Always clear the previous district when the state changes.
      district.value = "";
      DS.clearFieldError("district");
      syncDistrictOptions();
      updateProgress();
    });
  }

    /* ------------------------------------------------------------------ */
  /* Type of Unique ID → Id proof format                                 */
  /* ------------------------------------------------------------------ */
    function wireIdProof() {
    const typeSelect = $("unique_id_type");
    const idProof = $("id_proof");
    const PLACEHOLDERS = {
      "Aadhaar Card": "Enter 12-digit Aadhaar number",
      "PAN Card": "Enter PAN number (e.g., GPWPD9017R)",
      "Electoral Card": "Enter Electoral ID (e.g., ABC1234567)",
      "Driving License": "Enter Driving License number",
      "College ID": "Enter College ID",
      "School 10th / 12th Marksheet": "Enter Roll / Register number",
    };
    function applyConstraints() {
      const pattern = DS.ID_PROOF_PATTERNS[typeSelect.value];
      idProof.maxLength = pattern ? pattern.maxLength : 30;
      idProof.inputMode = pattern ? pattern.inputMode : "text";
      idProof.placeholder = PLACEHOLDERS[typeSelect.value] || "e.g. GPWPD901R";
    }
    typeSelect.addEventListener("change", function () {
      // A value valid for the previous ID type is not necessarily valid
      // for the new one — clear it rather than let a stale value slip
      // through unrevalidated (matches the state→district reset pattern).
      idProof.value = "";
      DS.clearFieldError("id_proof");
      applyConstraints();
      updateProgress();
    });
    idProof.addEventListener("input", function () {
      const pattern = DS.ID_PROOF_PATTERNS[typeSelect.value];
      if (!pattern || !pattern.normalize) return;
      const pos = idProof.selectionStart;
      const before = idProof.value;
      const after = pattern.normalize(before);
      if (after !== before) {
        idProof.value = after;
        const shift = before.length - after.length;
        const newPos = Math.max(0, pos - shift);
        idProof.setSelectionRange(newPos, newPos);
      }
    });
    applyConstraints();
  }
  /* ------------------------------------------------------------------ */
  /* Last Completed Education → Degree / Education document              */
  /* ------------------------------------------------------------------ */
  function wireEducation() {
    const education = $("last_completed_education");
    const degreeWrap = $("degreeWrap");
    const degreeSelect = $("degree_specialization");
    const fileWrap = $("educationFileWrap");
    const fileInput = $("education_file");
    function sync() {
      const notCompleted = education.value === "1-Not completed formal education";
      degreeWrap.classList.toggle("show", !notCompleted);
      degreeSelect.disabled = notCompleted;
      degreeSelect.required = !notCompleted;
      fileWrap.classList.toggle("show", !notCompleted);
      fileInput.disabled = notCompleted;
      fileInput.required = !notCompleted;
      if (notCompleted) {
        degreeSelect.value = "";
        DS.clearFieldError("degree_specialization");
        fileInput.value = "";
        $("education_file_meta").classList.remove("show");
        DS.clearFieldError("education_file");
      }
      updateProgress();
    }
    education.addEventListener("change", sync);
    sync();
  }
  /* ------------------------------------------------------------------ */
  /* Occupation → Institution (§11)                                      */
  /* ------------------------------------------------------------------ */
  function wireOccupation() {
    const occupation = $("occupation");
    const wrap = $("institutionWrap");
    const select = $("institution_type");

    function sync() {
      const isStudent = occupation.value === "4-Student";
      wrap.classList.toggle("show", isStudent);
      select.disabled = !isStudent;
      select.required = isStudent;
      if (!isStudent) {
        select.value = "";                 // never submitted for non-students
        DS.clearFieldError("institution_type");
      }
      updateProgress();
    }

    occupation.addEventListener("change", sync);
    sync();
  }

  /* ------------------------------------------------------------------ */
  /* PWD → PWD Certificate (§15)                                         */
  /* ------------------------------------------------------------------ */
  function wirePwd() {
    const pwd = $("pwd_status");
    const wrap = $("pwdWrap");
    const input = $("pwd_file");

    function sync() {
      const isYes = pwd.value === "Yes - 1";
      wrap.classList.toggle("show", isYes);
      input.disabled = !isYes;
      input.required = isYes;
      if (!isYes) {
        input.value = "";                  // nothing is uploaded, nothing stored
        $("pwd_file_meta").classList.remove("show");
        DS.clearFieldError("pwd_file");
      }
      updateProgress();
    }

    pwd.addEventListener("change", sync);
    sync();
  }

  /* ------------------------------------------------------------------ */
  /* File inputs                                                         */
  /* ------------------------------------------------------------------ */
  function wireFiles() {
    Object.values(FILE_FIELDS).forEach((cfg) => {
      const input = $(cfg.input);
      const meta = $(cfg.input + "_meta");
      if (!input) return;

      input.addEventListener("change", function () {
        const file = input.files && input.files[0];
        if (!file) {
          meta.classList.remove("show");
          updateProgress();
          return;
        }

        meta.querySelector("span").textContent = `${file.name} · ${DS.formatBytes(file.size)}`;
        meta.classList.add("show");

        const error = DS.validateFile(file, true);
        if (error) {
          DS.setFieldError(cfg.field, error);
          input.value = "";
          meta.classList.remove("show");
        } else {
          DS.clearFieldError(cfg.field);
        }
        updateProgress();
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Live validation                                                     */
  /* ------------------------------------------------------------------ */
  function wireLiveValidation() {
    FIELDS.forEach((name) => {
      const el = $(name);
      if (!el) return;

      const check = () => {
        const error = DS.validateValue(name, el.value, collect());
        if (error) DS.setFieldError(name, error);
        else DS.clearFieldError(name);
        updateProgress();
      };

      el.addEventListener("blur", check);
      el.addEventListener("change", check);
      el.addEventListener("input", function () {
        // Clear an existing error as soon as the value becomes valid;
        // never nag while the student is still typing.
        if (DS.fieldEl(name) && DS.fieldEl(name).classList.contains("is-invalid")) {
          if (!DS.validateValue(name, el.value, collect())) DS.clearFieldError(name);
        }
        updateProgress();
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Progress indicator                                                  */
  /* ------------------------------------------------------------------ */
  function updateProgress() {
    let total = 0;
    let done = 0;

    FIELDS.forEach((name) => {
      const el = $(name);
      if (!el || el.disabled) return;
      total++;
      if (el.value.trim()) done++;
    });

    Object.values(FILE_FIELDS).forEach((cfg) => {
      const input = $(cfg.input);
      if (!input || input.disabled) return;
      total++;
      if (input.files && input.files.length) done++;
    });

    const pct = total ? Math.round((done / total) * 100) : 0;
    $("progressBar").style.width = pct + "%";
    $("progressPercent").textContent = pct + "%";
    $("progressRole").setAttribute("aria-valuenow", String(pct));

    const mobilizationDone = ["unique_id_type", "id_proof", "first_name", "last_name",
      "date_of_birth", "gender", "beneficiary_state", "district", "contact_number",
      "email", "ews_category"].every((n) => val(n));

    $("progressSection").textContent = mobilizationDone
      ? "Section 2 of 2 · Enrolment"
      : "Section 1 of 2 · Mobilization";
  }

  /* ------------------------------------------------------------------ */
  /* Maintenance lock (§30)                                              */
  /* ------------------------------------------------------------------ */
  async function checkMaintenance() {
    try {
      const { data, error } = await DS.supabase.rpc("registration_status");
      if (error) return;

      const locked = !!(data && data.is_locked);
      if (locked === isLocked) return;
      isLocked = locked;

      if (locked) {
        DS.showBanner("maintenanceBanner", "Updating registrations. Please wait...", false);
        $("submitBtn").disabled = true;
      } else {
        DS.showBanner("maintenanceBanner", "Registration is available again.", false);
        setTimeout(() => DS.hideBanner("maintenanceBanner"), 4000);
        if (!isSubmitting) $("submitBtn").disabled = false;
      }
    } catch (err) {
      console.warn("Status check failed:", err);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Collect + validate                                                  */
  /* ------------------------------------------------------------------ */
  function collect() {
    const data = {};
    FIELDS.forEach((name) => {
      const el = $(name);
      if (!el) return;
      // Disabled conditional fields are submitted as empty, never as a value.
      data[name] = el.disabled ? "" : el.value.trim();
    });
    // Email is never auto-lowercased — uppercase is rejected, not fixed (§7.10).
    data.email = $("email") ? $("email").value.trim() : "";
    return data;
  }

  function validateAll() {
    DS.clearAllErrors();
    const data = collect();
    let count = 0;

    FIELDS.forEach((name) => {
      const el = $(name);
      if (!el || el.disabled) return;
      const error = DS.validateValue(name, data[name], data);
      if (error) { DS.setFieldError(name, error); count++; }
    });

    Object.entries(FILE_FIELDS).forEach(([, cfg]) => {
      const input = $(cfg.input);
      if (!input || input.disabled) return;
      const file = input.files && input.files[0];
      const error = DS.validateFile(file, cfg.required());
      if (error) { DS.setFieldError(cfg.field, error); count++; }
    });

    return { data, errorCount: count };
  }

  /* ------------------------------------------------------------------ */
  /* Submit (§19, §46, §52)                                              */
  /* ------------------------------------------------------------------ */
  function wireSubmit() {
    $("registrationForm").addEventListener("submit", async function (event) {
      event.preventDefault();
      if (isSubmitting) return;                       // no double registrations

      DS.hideBanner("formBanner");
      const { data, errorCount } = validateAll();

      if (errorCount > 0) {
        DS.showBanner("formBanner",
          `Please correct ${errorCount} highlighted ${errorCount === 1 ? "field" : "fields"} and submit again.`,
          true);
        DS.focusFirstError();
        return;
      }

      setSubmitting(true, "Preparing your documents…");

      try {
        // ---- 1. Which files are we sending? -------------------------
        const uploads = [];
        Object.entries(FILE_FIELDS).forEach(([kind, cfg]) => {
          const input = $(cfg.input);
          if (!input || input.disabled) return;
          const file = input.files && input.files[0];
          if (file) uploads.push({ kind, file });
        });

        // ---- 2. Ask the server for signed upload slots ---------------
        const slotRes = await DS.callFunction("register", {
          action: "upload-slots",
          files: uploads.map((u) => ({
            kind: u.kind,
            filename: u.file.name,
            size: u.file.size,
            type: DS.contentTypeFor(u.file.name),
          })),
        });

        if (!slotRes.ok) return handleServerFailure(slotRes);

        // ---- 3. Upload directly to private storage (in parallel) ----
        setSubmitting(true, "Uploading documents…");
        const uploadResults = await Promise.all(uploads.map((u) => {
          const slot = slotRes.slots[u.kind];
          return DS.supabase.storage
            .from(DS.BUCKET)
            .uploadToSignedUrl(slot.path, slot.token, u.file, {
              contentType: DS.contentTypeFor(u.file.name),
              upsert: true,
            });
        }));

        const failedUpload = uploadResults.find((r) => r.error);
        if (failedUpload) {
          console.error("upload error:", failedUpload.error);
          DS.showBanner("formBanner",
            "We could not upload your documents. Please check your connection and try again.", true);
          setSubmitting(false);
          return;
        }

        // ---- 4. Submit for validation + atomic ID allocation --------
        setSubmitting(true, "Registering…");
        const result = await DS.callFunction("register", {
          action: "submit",
          staging_id: slotRes.staging_id,
          data,
        });

        if (!result.ok) return handleServerFailure(result);

        // ---- 5. Success -------------------------------------------
        showSuccess(result.mafoi_id);
      } catch (err) {
        console.error("submit failed:", err);
        DS.showBanner("formBanner", DS.GENERIC_ERROR, true);
        setSubmitting(false);
      }
    });
  }

  function handleServerFailure(res) {
    setSubmitting(false);

    if (Array.isArray(res.errors) && res.errors.length) {
      DS.clearAllErrors();
      res.errors.forEach((e) => DS.setFieldError(e.field, e.message));
      DS.showBanner("formBanner",
        res.message || "Please correct the highlighted fields and submit again.", true);
      DS.focusFirstError();
      return;
    }

    if (res.code === "MAINTENANCE_LOCK") {
      DS.showBanner("maintenanceBanner", "Updating registrations. Please wait...", false);
    }

    DS.showBanner("formBanner", res.message || DS.GENERIC_ERROR, true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function setSubmitting(state, statusText) {
    isSubmitting = state;
    $("submitBtn").disabled = state || isLocked;
    $("submitSpinner").classList.toggle("d-none", !state);
    $("submitLabel").innerHTML = state
      ? "Submitting…"
      : '<i class="bi bi-send-fill me-2"></i>Submit Registration';
    $("submitStatus").textContent = state ? (statusText || "") : "";
  }

  function showSuccess(mafoiId) {
    $("successMafoiId").textContent = mafoiId;         // straight from the server
    const overlay = $("successOverlay");
    overlay.classList.add("show");
    document.body.style.overflow = "hidden";
    setTimeout(() => overlay.focus && overlay.focus(), 100);

    const againBtn = $("submitAnotherBtn");
    if (againBtn) {
      againBtn.addEventListener("click", () => window.location.reload());
    }
  }
})(window.DS);
