/* =====================================================================
   Admin dashboard controller.

   Authentication is Supabase Auth. Authorization is a second, separate
   check against admin_users — enforced by RLS on every read and again
   inside the Edge Function on every write (§32, §33, §59).
   ===================================================================== */
(function (DS) {
  "use strict";

  const $ = (id) => document.getElementById(id);

  let registrations = [];
  let pendingDelete = null;
  let deleteModal = null;
  let isDeleting = false;

  /* ------------------------------------------------------------------ */
  /* Boot                                                                */
  /* ------------------------------------------------------------------ */
  document.addEventListener("DOMContentLoaded", async function () {
    deleteModal = new bootstrap.Modal($("deleteModal"));

    if (!DS.configReady) {
      showLoginError("This site is not configured yet. Please contact the technical administrator.");
      $("loginBtn").disabled = true;
      return;
    }

    wireLogin();
    wireDashboard();

    const { data } = await DS.supabase.auth.getSession();
    if (data && data.session) await enterDashboard(data.session);

    DS.supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") showLogin();
    });
  });

  /* ------------------------------------------------------------------ */
  /* Login                                                               */
  /* ------------------------------------------------------------------ */
  function wireLogin() {
    $("loginForm").addEventListener("submit", async function (event) {
      event.preventDefault();
      DS.hideBanner("loginBanner");
      DS.clearAllErrors();

      const email = $("login_email").value.trim();
      const password = $("login_password").value;
      let bad = false;

      if (!email) { DS.setFieldError("login_email", "Please enter your email."); bad = true; }
      if (!password) { DS.setFieldError("login_password", "Please enter your password."); bad = true; }
      if (bad) return;

      setLoginBusy(true);

      const { data, error } = await DS.supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setLoginBusy(false);
        showLoginError("Incorrect email or password.");
        return;
      }

      const ok = await enterDashboard(data.session);
      if (!ok) setLoginBusy(false);
    });

    $("logoutBtn").addEventListener("click", async function () {
      await DS.supabase.auth.signOut();
      showLogin();
    });
  }

  function setLoginBusy(busy) {
    $("loginBtn").disabled = busy;
    $("loginSpinner").classList.toggle("d-none", !busy);
    $("loginLabel").textContent = busy ? "Signing in…" : "Sign in";
  }

  function showLoginError(message) {
    DS.showBanner("loginBanner", message, true);
  }

  function showLogin() {
    $("loginView").hidden = false;
    $("dashboardView").hidden = true;
    $("navActions").hidden = true;
    $("login_password").value = "";
    setLoginBusy(false);
    registrations = [];
  }

  /* ------------------------------------------------------------------ */
  /* Authorization gate                                                  */
  /* ------------------------------------------------------------------ */
  async function enterDashboard(session) {
    // Authentication alone is not enough — the UUID must be in admin_users.
    const { data, error } = await DS.supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (error || !data) {
      await DS.supabase.auth.signOut();
      showLogin();
      showLoginError("This account is not authorised to access the admin dashboard.");
      return false;
    }

    $("loginView").hidden = true;
    $("dashboardView").hidden = false;
    $("navActions").hidden = false;
    $("adminEmail").textContent = session.user.email || "";

    await loadRegistrations();
    return true;
  }

  /* ------------------------------------------------------------------ */
  /* Data                                                                */
  /* ------------------------------------------------------------------ */
  async function loadRegistrations() {
    const { data, error } = await DS.supabase
      .from("registrations")
      .select("*")
      .order("serial_no", { ascending: true });

    if (error) {
      // An expired session surfaces here first.
      const { data: sess } = await DS.supabase.auth.getSession();
      if (!sess || !sess.session) { showLogin(); return; }
      DS.showBanner("dashBanner", "Could not load registrations. Please refresh.", true);
      return;
    }

    registrations = data || [];
    renderStats();
    renderTable();
  }

  function renderStats() {
    const count = (course) => registrations.filter((r) => r.domain_course === course).length;
    $("statTotal").textContent = registrations.length;
    $("statDA").textContent = count("Data Analytics");
    $("statAI").textContent = count("Artificial Intelligence");
    $("statCS").textContent = count("Cyber Security");
  }

  function visibleRows() {
    const term = $("searchInput").value.trim().toLowerCase();
    const course = $("courseFilter").value;

    return registrations.filter((r) => {
      if (course && r.domain_course !== course) return false;
      if (!term) return true;
      return [r.mafoi_id, r.first_name, r.last_name, r.email, r.contact_number]
        .some((v) => String(v || "").toLowerCase().includes(term));
    });
  }

  function renderTable() {
    const rows = visibleRows();
    const body = $("tableBody");
    const esc = DS.escapeHtml;

    if (!rows.length) {
      body.innerHTML = "";
      $("emptyState").hidden = false;
      $("emptyText").textContent = registrations.length
        ? "No registrations match your search or filter."
        : "No registrations yet.";
      $("resultCount").textContent = `Showing 0 of ${registrations.length} registrations`;
      return;
    }

    $("emptyState").hidden = true;
    $("resultCount").textContent = `Showing ${rows.length} of ${registrations.length} registrations`;

        body.innerHTML = rows.map((r) => `
      <tr>
        <td><span class="ds-mafoi">${esc(r.mafoi_id)}</span></td>
        <td>${esc(r.unique_id_type)}</td>
        <td>${esc(r.id_proof)}</td>
        <td>${esc(r.first_name)}</td>
        <td>${esc(r.last_name)}</td>
        <td>${esc(DS.formatDate(r.date_of_birth))}</td>
        <td>${esc(r.gender)}</td>
        <td>${esc(r.beneficiary_state)}</td>
        <td>${esc(r.district)}</td>
        <td>${esc(r.contact_number)}</td>
        <td>${esc(r.email)}</td>
        <td>${esc(r.ews_category)}</td>
        <td>${esc(r.last_completed_education)}</td>
        <td>${esc(r.degree_specialization)}</td>
        <td>${esc(r.annual_income)}</td>
        <td>${esc(r.occupation)}</td>
        <td>${r.institution_type ? esc(r.institution_type) : '<span class="ds-help">—</span>'}</td>
        <td><span class="ds-chip">${esc(r.domain_course)}</span></td>
        <td>${esc(r.pwd_status)}</td>
        <td>${esc(r.parent_name)}</td>
        <td>${esc(r.alternative_contact_number)}</td>
        <td>${esc(r.social_category)}</td>
        <td>${esc(DS.formatDateTime(r.created_at))}</td>
        <td>${documentLinks(r)}</td>
        <td class="text-center">
          <button class="btn btn-ds-danger" type="button" data-delete="${esc(r.id)}"
                  title="Delete ${esc(r.mafoi_id)}" aria-label="Delete ${esc(r.mafoi_id)}">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>`).join("");
  }

  /** Document names come straight from the database — never reconstructed. */
  function documentLinks(r) {
    const esc = DS.escapeHtml;
    const items = [
      [r.education_document_name, r.education_document_path],
      [r.ews_certificate_name, r.ews_certificate_path],
      [r.pwd_certificate_name, r.pwd_certificate_path],
    ].filter(([name, path]) => name && path);

    if (!items.length) return '<span class="ds-help">—</span>';

    return items.map(([name, path]) => `
      <a class="ds-doc-link" role="button" tabindex="0"
         data-doc="${esc(path)}" data-name="${esc(name)}" title="${esc(name)}">
        <i class="bi bi-file-earmark-arrow-down"></i>${esc(name)}
      </a>`).join("");
  }

  /* ------------------------------------------------------------------ */
  /* Interactions                                                        */
  /* ------------------------------------------------------------------ */
  function wireDashboard() {
    $("searchInput").addEventListener("input", renderTable);
    $("courseFilter").addEventListener("change", renderTable);
    $("refreshBtn").addEventListener("click", loadRegistrations);

    $("excelBtn").addEventListener("click", async function () {
      DS.hideBanner("dashBanner");
      // Always export the latest committed state, never the cached table.
      await loadRegistrations();

      const rows = visibleRows();       // respects the search box + course filter
      if (!rows.length) {
        DS.showBanner("dashBanner",
          registrations.length
            ? "No registrations match your current search or filter."
            : "There are no registrations to export yet.",
          true);
        return;
      }
      try {
        const filename = await DS.exportRegistrations(rows);
        DS.showBanner("dashBanner", `Downloaded ${filename}`, false);
        setTimeout(() => DS.hideBanner("dashBanner"), 5000);
      } catch (err) {
        console.error("excel export:", err);
        DS.showBanner("dashBanner", "Could not generate the Excel file. Please try again.", true);
      }
    });

    $("tableBody").addEventListener("click", onTableClick);
    $("tableBody").addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        if (event.target.closest("[data-doc]")) { event.preventDefault(); onTableClick(event); }
      }
    });

    $("confirmDeleteBtn").addEventListener("click", performDelete);
  }

  async function onTableClick(event) {
    const del = event.target.closest("[data-delete]");
    if (del) return openDeleteModal(del.getAttribute("data-delete"));

    const doc = event.target.closest("[data-doc]");
    if (doc) return openDocument(doc.getAttribute("data-doc"), doc.getAttribute("data-name"));
  }

  /** Private bucket: a short-lived signed URL, never a public URL (§37). */
  async function openDocument(path, filename) {
    DS.hideBanner("dashBanner");
    const { data, error } = await DS.supabase.storage
      .from(DS.BUCKET)
      .createSignedUrl(path, 120, { download: filename });

    if (error || !data) {
      DS.showBanner("dashBanner", "Could not open that document. It may have been moved.", true);
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  function openDeleteModal(id) {
    const row = registrations.find((r) => r.id === id);
    if (!row) return;

    pendingDelete = row;
    $("delMafoi").textContent = row.mafoi_id;
    $("delName").textContent = `${row.first_name} ${row.last_name}`;
    $("delEmail").textContent = row.email;
    DS.hideBanner("modalBanner");
    setDeleteBusy(false);
    deleteModal.show();
  }

  function setDeleteBusy(busy) {
    isDeleting = busy;
    $("confirmDeleteBtn").disabled = busy;
    $("cancelDeleteBtn").disabled = busy;
    $("modalCloseX").disabled = busy;
    $("deleteSpinner").classList.toggle("d-none", !busy);
    $("deleteLabel").innerHTML = busy
      ? "Deleting &amp; reindexing…"
      : '<i class="bi bi-trash me-1"></i>Delete &amp; Reindex';
  }

  async function performDelete() {
    if (!pendingDelete || isDeleting) return;
    setDeleteBusy(true);
    DS.hideBanner("modalBanner");

    const { data: sess } = await DS.supabase.auth.getSession();
    if (!sess || !sess.session) { showLogin(); return; }

    const result = await DS.callFunction(
      "admin-delete-reindex",
      { registration_id: pendingDelete.id },
      sess.session.access_token,
    );

    if (!result.ok) {
      setDeleteBusy(false);
      if (result.code === "UNAUTHENTICATED") { showLogin(); showLoginError("Your session expired. Please sign in again."); return; }
      DS.showBanner("modalBanner", result.message || DS.GENERIC_ERROR, true);
      return;
    }

    // The function returns the post-reindex list, so the dashboard, the
    // database, the Excel export and the file names can never disagree.
    registrations = result.registrations || [];
    renderStats();
    renderTable();

    setDeleteBusy(false);
    deleteModal.hide();

    const reindexed = result.reindexed || 0;
    DS.showBanner("dashBanner",
      `${pendingDelete.mafoi_id} deleted. ${reindexed} registration${reindexed === 1 ? "" : "s"} reindexed and renamed.`,
      false);
    setTimeout(() => DS.hideBanner("dashBanner"), 6000);
    pendingDelete = null;
  }
})(window.DS);
