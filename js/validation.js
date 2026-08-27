/* =====================================================================
   Client-side validation.
   Mirrors supabase/functions/_shared/validation.ts and the CHECK
   constraints in schema.sql. The server remains the authority — this
   layer exists purely for fast, friendly feedback (§42).
   ===================================================================== */
window.DS = window.DS || {};

(function (DS) {
  "use strict";

      DS.STATES = [
    "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat",
    "Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh",
    "Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab",
    "Rajasthan","Sikkim","TamilNadu","Telangana","Tripura","Uttar Pradesh",
    "Uttarakhand","West Bengal",
    "Andaman and Nicobar Islands","Chandigarh",
    "Dadra and Nagar Haveli and Daman and Diu","Delhi","Jammu and Kashmir",
    "Ladakh","Lakshadweep","Puducherry",
  ];
  // NOTE: Tamil Nadu (38) and Andhra Pradesh (26) are verified current
  // official district lists. Every other state/UT below is a best-effort
  // list and should be checked against the state's own gazette / the
  // Government of India district directory before this goes live for
  // beneficiaries in that state, since Indian districts are reorganised
  // fairly often (this happened to TN and AP themselves in recent years).
  DS.DISTRICTS = {
        "TamilNadu": [
      "Ariyalur","Chengalpattu","Chennai","Coimbatore","Cuddalore","Dharmapuri","Dindigul",
      "Erode","Kallakurichi","Kancheepuram","Kanyakumari","Karur","Krishnagiri","Madurai",
      "Mayiladuthurai","Nagapattinam","Namakkal","Nilgiris","Perambalur","Pudukkottai",
      "Ramanathapuram","Ranipet","Salem","Sivaganga","Tenkasi","Thanjavur","Theni",
      "Thoothukudi","Tiruchirappalli","Tirunelveli","Tirupathur","Tiruppur","Tiruvallur",
      "Tiruvannamalai","Tiruvarur","Vellore","Viluppuram","Virudhunagar",
    ],
    "Andhra Pradesh": [
      "Alluri Sitharama Raju","Anakapalli","Anantapur","Annamayya","Bapatla","Chittoor",
      "Dr. B.R. Ambedkar Konaseema","East Godavari","Eluru","Guntur","Kakinada","Krishna",
      "Kurnool","Nandyal","NTR","Palnadu","Parvathipuram Manyam","Prakasam",
      "Sri Sathya Sai","SPSR Nellore","Srikakulam","Tirupati","Visakhapatnam","Vizianagaram",
      "West Godavari","YSR Kadapa",
    ],
    "Karnataka": [
      "Bagalkot","Ballari","Belagavi","Bengaluru Rural","Bengaluru Urban","Bidar","Chamarajanagar",
      "Chikkaballapur","Chikkamagaluru","Chitradurga","Dakshina Kannada","Davanagere","Dharwad",
      "Gadag","Hassan","Haveri","Kalaburagi","Kodagu","Kolar","Koppal","Mandya","Mysuru",
      "Raichur","Ramanagara","Shivamogga","Tumakuru","Udupi","Uttara Kannada","Vijayanagara",
      "Vijayapura","Yadgir",
    ],
    "Kerala": [
      "Alappuzha","Ernakulam","Idukki","Kannur","Kasaragod","Kollam","Kottayam","Kozhikode",
      "Malappuram","Palakkad","Pathanamthitta","Thiruvananthapuram","Thrissur","Wayanad",
    ],
    "Telangana": [
      "Adilabad","Bhadradri Kothagudem","Hanumakonda","Hyderabad","Jagtial","Jangaon",
      "Jayashankar Bhupalpally","Jogulamba Gadwal","Kamareddy","Karimnagar","Khammam",
      "Kumuram Bheem Asifabad","Mahabubabad","Mahabubnagar","Mancherial","Medak",
      "Medchal-Malkajgiri","Mulugu","Nagarkurnool","Nalgonda","Narayanpet","Nirmal",
      "Nizamabad","Peddapalli","Rajanna Sircilla","Rangareddy","Sangareddy","Siddipet",
      "Suryapet","Vikarabad","Wanaparthy","Warangal","Yadadri Bhuvanagiri",
    ],
    "Maharashtra": [
      "Ahmednagar","Akola","Amravati","Beed","Bhandara","Buldhana","Chandrapur","Chhatrapati Sambhajinagar",
      "Dhule","Gadchiroli","Gondia","Hingoli","Jalgaon","Jalna","Kolhapur","Latur","Mumbai City",
      "Mumbai Suburban","Nagpur","Nanded","Nandurbar","Nashik","Osmanabad","Palghar","Parbhani",
      "Pune","Raigad","Ratnagiri","Sangli","Satara","Sindhudurg","Solapur","Thane","Wardha",
      "Washim","Yavatmal",
    ],
    "Gujarat": [
      "Ahmedabad","Amreli","Anand","Aravalli","Banaskantha","Bharuch","Bhavnagar","Botad",
      "Chhota Udepur","Dahod","Dang","Devbhoomi Dwarka","Gandhinagar","Gir Somnath","Jamnagar",
      "Junagadh","Kheda","Kutch","Mahisagar","Mehsana","Morbi","Narmada","Navsari","Panchmahal",
      "Patan","Porbandar","Rajkot","Sabarkantha","Surat","Surendranagar","Tapi","Vadodara",
      "Valsad",
    ],
    "Rajasthan": [
      "Ajmer","Alwar","Anupgarh","Balotra","Banswara","Baran","Barmer","Beawar","Bharatpur",
      "Bhilwara","Bikaner","Bundi","Chittorgarh","Churu","Dausa","Deeg","Dholpur","Didwana-Kuchaman",
      "Dungarpur","Ganganagar","Hanumangarh","Jaipur","Jaipur Rural","Jaisalmer","Jalore",
      "Jhalawar","Jhunjhunu","Jodhpur","Jodhpur Rural","Karauli","Kekri","Khairthal-Tijara",
      "Kota","Kotputli-Behror","Nagaur","Neem Ka Thana","Pali","Phalodi","Pratapgarh",
      "Rajsamand","Salumbar","Sanchore","Sawai Madhopur","Shahpura","Sikar","Sirohi",
      "Tonk","Udaipur",
    ],
    "Madhya Pradesh": [
      "Agar Malwa","Alirajpur","Anuppur","Ashoknagar","Balaghat","Barwani","Betul","Bhind",
      "Bhopal","Burhanpur","Chhatarpur","Chhindwara","Damoh","Datia","Dewas","Dhar","Dindori",
      "Guna","Gwalior","Harda","Hoshangabad (Narmadapuram)","Indore","Jabalpur","Jhabua","Katni",
      "Khandwa","Khargone","Mainpuri","Mandla","Mandsaur","Morena","Narsinghpur","Neemuch",
      "Niwari","Panna","Raisen","Rajgarh","Ratlam","Rewa","Sagar","Satna","Sehore","Seoni",
      "Shahdol","Shajapur","Sheopur","Shivpuri","Sidhi","Singrauli","Tikamgarh","Ujjain",
      "Umaria","Vidisha",
    ],
    "Uttar Pradesh": [
      "Agra","Aligarh","Ambedkar Nagar","Amethi","Amroha","Auraiya","Ayodhya","Azamgarh",
      "Baghpat","Bahraich","Ballia","Balrampur","Banda","Barabanki","Bareilly","Basti",
      "Bhadohi","Bijnor","Budaun","Bulandshahr","Chandauli","Chitrakoot","Deoria","Etah",
      "Etawah","Farrukhabad","Fatehpur","Firozabad","Gautam Buddha Nagar","Ghaziabad",
      "Ghazipur","Gonda","Gorakhpur","Hamirpur","Hapur","Hardoi","Hathras","Jalaun","Jaunpur",
      "Jhansi","Kannauj","Kanpur Dehat","Kanpur Nagar","Kasganj","Kaushambi","Kheri","Kushinagar",
      "Lalitpur","Lucknow","Maharajganj","Mahoba","Mainpuri","Mathura","Mau","Meerut","Mirzapur",
      "Moradabad","Muzaffarnagar","Pilibhit","Pratapgarh","Prayagraj","Raebareli","Rampur",
      "Saharanpur","Sambhal","Sant Kabir Nagar","Shahjahanpur","Shamli","Shravasti","Siddharthnagar",
      "Sitapur","Sonbhadra","Sultanpur","Unnao","Varanasi",
    ],
    "Bihar": [
      "Araria","Arwal","Aurangabad","Banka","Begusarai","Bhagalpur","Bhojpur","Buxar","Darbhanga",
      "East Champaran","Gaya","Gopalganj","Jamui","Jehanabad","Kaimur","Katihar","Khagaria",
      "Kishanganj","Lakhisarai","Madhepura","Madhubani","Munger","Muzaffarpur","Nalanda",
      "Nawada","Patna","Purnia","Rohtas","Saharsa","Samastipur","Saran","Sheikhpura","Sheohar",
      "Sitamarhi","Siwan","Supaul","Vaishali","West Champaran",
    ],
    "West Bengal": [
      "Alipurduar","Bankura","Birbhum","Cooch Behar","Dakshin Dinajpur","Darjeeling","Hooghly",
      "Howrah","Jalpaiguri","Jhargram","Kalimpong","Kolkata","Malda","Murshidabad","Nadia",
      "North 24 Parganas","Paschim Bardhaman","Paschim Medinipur","Purba Bardhaman",
      "Purba Medinipur","Purulia","South 24 Parganas","Uttar Dinajpur",
    ],
    "Punjab": [
      "Amritsar","Barnala","Bathinda","Faridkot","Fatehgarh Sahib","Fazilka","Ferozepur",
      "Gurdaspur","Hoshiarpur","Jalandhar","Kapurthala","Ludhiana","Malerkotla","Mansa",
      "Moga","Muktsar","Pathankot","Patiala","Rupnagar","Sangrur","SAS Nagar (Mohali)",
      "Shaheed Bhagat Singh Nagar","Tarn Taran",
    ],
    "Haryana": [
      "Ambala","Bhiwani","Charkhi Dadri","Faridabad","Fatehabad","Gurugram","Hisar","Jhajjar",
      "Jind","Kaithal","Karnal","Kurukshetra","Mahendragarh","Nuh","Palwal","Panchkula",
      "Panipat","Rewari","Rohtak","Sirsa","Sonipat","Yamunanagar",
    ],
    "Odisha": [
      "Angul","Balangir","Balasore","Bargarh","Bhadrak","Boudh","Cuttack","Deogarh","Dhenkanal",
      "Gajapati","Ganjam","Jagatsinghpur","Jajpur","Jharsuguda","Kalahandi","Kandhamal","Kendrapara",
      "Kendujhar","Khordha","Koraput","Malkangiri","Mayurbhanj","Nabarangpur","Nayagarh","Nuapada",
      "Puri","Rayagada","Sambalpur","Subarnapur","Sundargarh",
    ],
    "Assam": [
      "Baksa","Barpeta","Biswanath","Bongaigaon","Cachar","Charaideo","Chirang","Darrang",
      "Dhemaji","Dhubri","Dibrugarh","Dima Hasao","Goalpara","Golaghat","Hailakandi","Hojai",
      "Jorhat","Kamrup","Kamrup Metropolitan","Karbi Anglong","Karimganj","Kokrajhar","Lakhimpur",
      "Majuli","Morigaon","Nagaon","Nalbari","Sivasagar","Sonitpur","South Salmara-Mankachar",
      "Tinsukia","Udalguri","West Karbi Anglong",
    ],
    "Chhattisgarh": [
      "Balod","Baloda Bazar","Balrampur","Bastar","Bemetara","Bijapur","Bilaspur","Dantewada",
      "Dhamtari","Durg","Gariaband","Gaurela-Pendra-Marwahi","Janjgir-Champa","Jashpur","Kabirdham",
      "Kanker","Kondagaon","Korba","Koriya","Mahasamund","Mungeli","Narayanpur","Raigarh",
      "Raipur","Rajnandgaon","Sukma","Surajpur","Surguja",
    ],
    "Jharkhand": [
      "Bokaro","Chatra","Deoghar","Dhanbad","Dumka","East Singhbhum","Garhwa","Giridih","Godda",
      "Gumla","Hazaribagh","Jamtara","Khunti","Koderma","Latehar","Lohardaga","Pakur","Palamu",
      "Ramgarh","Ranchi","Sahibganj","Seraikela Kharsawan","Simdega","West Singhbhum",
    ],
    "Himachal Pradesh": [
      "Bilaspur","Chamba","Hamirpur","Kangra","Kinnaur","Kullu","Lahaul and Spiti","Mandi",
      "Shimla","Sirmaur","Solan","Una",
    ],
    "Uttarakhand": [
      "Almora","Bageshwar","Chamoli","Champawat","Dehradun","Haridwar","Nainital","Pauri Garhwal",
      "Pithoragarh","Rudraprayag","Tehri Garhwal","Udham Singh Nagar","Uttarkashi",
    ],
    "Goa": ["North Goa","South Goa"],
    "Tripura": ["Dhalai","Gomati","Khowai","North Tripura","Sepahijala","South Tripura","Unakoti","West Tripura"],
    "Meghalaya": [
      "East Garo Hills","East Jaintia Hills","East Khasi Hills","North Garo Hills","Ri Bhoi",
      "South Garo Hills","South West Garo Hills","South West Khasi Hills","West Garo Hills",
      "West Jaintia Hills","West Khasi Hills",
    ],
    "Manipur": [
      "Bishnupur","Chandel","Churachandpur","Imphal East","Imphal West","Jiribam","Kakching",
      "Kamjong","Kangpokpi","Noney","Pherzawl","Senapati","Tamenglong","Tengnoupal","Thoubal",
      "Ukhrul",
    ],
    "Nagaland": [
      "Chumoukedima","Dimapur","Kiphire","Kohima","Longleng","Mokokchung","Mon","Niuland",
      "Noklak","Peren","Phek","Shamator","Tuensang","Tseminyu","Wokha","Zunheboto",
    ],
    "Mizoram": [
      "Aizawl","Champhai","Hnahthial","Khawzawl","Kolasib","Lawngtlai","Lunglei","Mamit",
      "Saiha","Saitual","Serchhip",
    ],
    "Arunachal Pradesh": [
      "Anjaw","Changlang","Dibang Valley","East Kameng","East Siang","Kamle","Kra Daadi",
      "Kurung Kumey","Lepa Rada","Lohit","Longding","Lower Dibang Valley","Lower Siang",
      "Lower Subansiri","Namsai","Pakke Kessang","Papum Pare","Shi Yomi","Siang","Tawang",
      "Tirap","Upper Dibang Valley","Upper Siang","Upper Subansiri","West Kameng","West Siang",
    ],
    "Sikkim": ["Gangtok","Gyalshing","Mangan","Namchi","Pakyong","Soreng"],
    "Delhi": [
      "Central Delhi","East Delhi","New Delhi","North Delhi","North East Delhi","North West Delhi",
      "Shahdara","South Delhi","South East Delhi","South West Delhi","West Delhi",
    ],
    "Jammu and Kashmir": [
      "Anantnag","Bandipora","Baramulla","Budgam","Doda","Ganderbal","Jammu","Kathua","Kishtwar",
      "Kulgam","Kupwara","Poonch","Pulwama","Rajouri","Ramban","Reasi","Samba","Shopian","Srinagar",
      "Udhampur",
    ],
    "Ladakh": ["Kargil","Leh"],
    "Chandigarh": ["Chandigarh"],
    "Puducherry": ["Karaikal","Mahe","Puducherry","Yanam"],
    "Andaman and Nicobar Islands": ["Nicobar","North and Middle Andaman","South Andaman"],
    "Lakshadweep": ["Lakshadweep"],
    "Dadra and Nagar Haveli and Daman and Diu": ["Dadra and Nagar Haveli","Daman","Diu"],
  };

    DS.ID_PROOF_PATTERNS = {
    "10th Marksheet": {
      regex: /^[A-Za-z0-9\/-]{3,25}$/,
      message: "Please enter a valid Roll Number / Register Number.",
      maxLength: 25,
      inputMode: "text",
      normalize: (v) => v.replace(/[^A-Za-z0-9\/-]/g, ""),
    },
    "12th Marksheet": {
      regex: /^[A-Za-z0-9\/-]{3,25}$/,
      message: "Please enter a valid Roll Number / Register Number.",
      maxLength: 25,
      inputMode: "text",
      normalize: (v) => v.replace(/[^A-Za-z0-9\/-]/g, ""),
    },
    "Degree Marksheet": {
      regex: /^[A-Za-z0-9\/-]{3,25}$/,
      message: "Please enter a valid Register Number / Marksheet Number.",
      maxLength: 25,
      inputMode: "text",
      normalize: (v) => v.replace(/[^A-Za-z0-9\/-]/g, ""),
    },
  };
  DS.MAX_FILE_BYTES = 10 * 1024 * 1024;
  DS.ALLOWED_EXT = ["pdf", "jpg", "jpeg"];
  DS.ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/jpg"];
  DS.PDF_ONLY_EXT = ["pdf"];
  DS.PDF_ONLY_MIME = ["application/pdf"];

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

            id_proof: (v, form) => {
      if (!v) return "Please enter your ID number.";
      const pattern = DS.ID_PROOF_PATTERNS[form.unique_id_type];
      if (pattern) return pattern.regex.test(v) ? null : pattern.message;
      if (!/^[A-Za-z0-9]+$/.test(v)) return "Only letters and numbers allowed — no spaces or dashes.";
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
        beneficiary_state: (v) => {
      if (!v) return "Please select your state.";
      if (!DS.STATES.includes(v)) return "Please select a state/UT from the suggestions.";
      return null;
    },

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

  /** File rules: extension + declared MIME + size (§8.3, §48, §71).
   *  allowedExt/allowedMime let a caller restrict to PDF-only (Supporting
   *  Documents) while EWS/PWD keep accepting PDF or JPG. */
  DS.validateFile = function (file, required, allowedExt, allowedMime) {
    if (!file) return required ? "Please upload this document." : null;

    const extList = allowedExt || DS.ALLOWED_EXT;
    const mimeList = allowedMime || DS.ALLOWED_MIME;
    const fileTypeLabel = extList.includes("jpg") ? "PDF or JPG" : "PDF";

    const ext = DS.extensionOf(file.name);
    if (!extList.includes(ext)) return `Please upload a ${fileTypeLabel} file.`;

    const mime = (file.type || "").toLowerCase();
    if (mime && !mimeList.includes(mime)) return `Please upload a ${fileTypeLabel} file.`;

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
