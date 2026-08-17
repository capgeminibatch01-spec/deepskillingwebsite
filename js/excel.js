/* =====================================================================
   XLSX export (§38, §39, §56, §69).

   Every column is written with an explicit cell type so Excel cannot
   reinterpret a Ma Foi ID, an ID number or a mobile number as a number
   and drop leading characters or zeros.
   ===================================================================== */
(function (DS) {
  "use strict";

  // [header, accessor, type]  type: "s" = text, "d" = real date
  const COLUMNS = [
    ["Ma Foi ID",                          (r) => r.mafoi_id,                   "s"],
    ["Type of unique ID",                  (r) => r.unique_id_type,             "s"],
    ["Id proof",                           (r) => r.id_proof,                   "s"],
    ["First Name",                         (r) => r.first_name,                 "s"],
    ["Last Name",                          (r) => r.last_name,                  "s"],
    ["Date of Birth",                      (r) => r.date_of_birth,              "d"],
    ["Gender",                             (r) => r.gender,                     "s"],
    ["Beneficiary State (Current)",        (r) => r.beneficiary_state,          "s"],
    ["District (Current)",                 (r) => r.district,                   "s"],
    ["Contact number",                     (r) => r.contact_number,             "s"],
    ["Email id",                           (r) => r.email,                      "s"],
    ["Do you belong to EWS category?",     (r) => r.ews_category,               "s"],
    ["Last Completed Education",           (r) => r.last_completed_education,   "s"],
    ["Degree / Specialization",            (r) => r.degree_specialization,      "s"],
    ["Supporting document (Education)",    (r) => r.education_document_name,    "s"],
    ["Annual income",                      (r) => r.annual_income,              "s"],
    ["Occupation",                         (r) => r.occupation,                 "s"],
    ["If Student, Type of Institution",    (r) => r.institution_type || "",     "s"],
    ["EWS Certification",                  (r) => r.ews_certificate_name,       "s"],
    ["Domain course",                      (r) => r.domain_course,              "s"],
    ["Are you a person with Disability?",  (r) => r.pwd_status,                 "s"],
    ["PWD Certificate",                    (r) => r.pwd_certificate_name || "", "s"],
    ["Name of parent",                     (r) => r.parent_name,                "s"],
    ["Alternative Contact Number",         (r) => r.alternative_contact_number, "s"],
    ["Social Category",                    (r) => r.social_category,            "s"],
    ["Created Date",                       (r) => r.created_at,                 "dt"],
  ];

  /** Excel serial = days since 1899-12-30. Written as a typed number so
   *  every Excel/LibreOffice build renders a real date, not a string. */
  function toSerial(ms) { return ms / 86400000 + 25569; }

  function dateCell(value) {
    if (!value) return { t: "s", v: "" };

    // Date-only: pinned to UTC midnight so no timezone can shift a DOB.
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split("-").map(Number);
      return { t: "n", v: Math.round(toSerial(Date.UTC(y, m - 1, d))), z: "dd-mmm-yyyy" };
    }

    const dt = new Date(value);
    if (isNaN(dt.getTime())) return { t: "s", v: String(value) };
    // Timestamps are shown in the admin's local time, matching the table.
    const localMs = dt.getTime() - dt.getTimezoneOffset() * 60000;
    return { t: "n", v: toSerial(localMs), z: "dd-mmm-yyyy hh:mm" };
  }

  DS.exportRegistrations = function (rows) {
    const sheet = {};
    const range = { s: { c: 0, r: 0 }, e: { c: COLUMNS.length - 1, r: rows.length } };

    // header row
    COLUMNS.forEach((col, c) => {
      sheet[XLSX.utils.encode_cell({ c, r: 0 })] = { t: "s", v: col[0] };
    });

    // data rows, always ordered by serial_no
    const ordered = [...rows].sort((a, b) => a.serial_no - b.serial_no);

    ordered.forEach((row, i) => {
      COLUMNS.forEach((col, c) => {
        const raw = col[1](row);
        const addr = XLSX.utils.encode_cell({ c, r: i + 1 });
        sheet[addr] = col[2] === "d" || col[2] === "dt"
          ? dateCell(raw)
          : { t: "s", v: raw == null ? "" : String(raw) };
      });
    });

    sheet["!ref"] = XLSX.utils.encode_range(range);
    sheet["!cols"] = COLUMNS.map((col) => ({
      wch: Math.min(Math.max(col[0].length + 4, 14), 42),
    }));
    sheet["!autofilter"] = { ref: sheet["!ref"] };

    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Registrations");

    const today = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const filename =
      `Deep_Skilling_Training_Registrations_${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}.xlsx`;

    XLSX.writeFile(book, filename, { compression: true });
    return filename;
  };
})(window.DS);
