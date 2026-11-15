// CareTrail UI strings in English and Arabic.
// Reason codes from the engine are rendered here, so both languages use the
// same logic. Arabic is a first draft and needs review by a native speaker
// before any pilot.

export const STR = {
  en: {
    dir: "ltr",
    app_tag: "Family screening passport",
    synthetic: "Prototype · synthetic data only",
    view_family: "Family app",
    view_program: "Program view",
    view_how: "How it works",
    lang_switch: "عربي",
    demo_family: "Demo family",
    tab_steps: "Next steps",
    tab_passport: "Passport",
    tab_privacy: "Privacy",
    tab_log: "Data log",
    hello: "Good to see you, {name}",
    you_manage: "You manage health reminders for {n} people.",
    steps_title_n: "{n} steps for your family this month",
    steps_title_0: "Nothing needs attention this month",
    steps_sub: "Ordered by what matters most: open follow-ups first, then higher-risk and overdue screenings.",
    more_steps: "{n} more",
    fewer_steps: "Show fewer",
    why: "Why this?",
    hide_why: "Hide",
    book: "Book",
    not_now: "Not now",
    booked: "Booking requested for {slot}",
    snoozed: "We'll remind you again on {date}",
    undo: "Undo",
    decision_population: "Program reminder",
    decision_clinical: "Your doctor decides",
    clinical_note: "CareTrail does not diagnose. This reminder follows the program standard; the next step is decided with your doctor.",
    factors: "What raised the priority",
    no_factors: "Routine reminder: age, sex and screening dates only.",
    data_used: "Data used",
    source: "Rule source",
    components_at_visit: "At this visit",
    book_title: "Book: {title}",
    book_for: "For {name}",
    book_where: "Suggested clinic in your {insurance} network (demo)",
    book_pick: "Pick a time",
    book_confirm: "Request booking",
    cancel: "Cancel",
    snooze_title: "Not now",
    snooze_30: "Remind me in 30 days",
    snooze_decline: "I don't want this screening",
    decline_note: "Your choice is recorded and respected. No reminders for 12 months. You can change this at any time.",
    wellbeing_title: "From your wearable",
    wellbeing_shared: "Shared with your consent. You can stop sharing in Privacy.",
    steps_day: "{n} steps a day",
    sleep_h: "{n} h sleep",
    wellbeing_tip: "Small changes help: a short walk after dinner and a fixed bedtime. In a pilot this card links to ADPHC-approved education material.",
    not_covered_title: "Adults in this family are not on Thiqa",
    not_covered_body: "IFHAS adult screening covers Thiqa members. Your insurer sets your preventive benefits. Children's Well-Child visits are covered for everyone.",
    lang_note_ur: "This family prefers Urdu. The program view flags an interpreter for outreach; the app UI is Arabic and English in this prototype.",
    private_member: "{name} keeps their screening private",
    private_body: "Only {name} can see their reminders.",
    passport_title: "Family passport",
    needs_action: "Needs action",
    up_to_date: "Up to date",
    other: "Other",
    no_items: "No screenings apply at this age.",
    visit_trail: "Well-Child visit trail",
    attended: "Attended",
    missed: "Missed",
    due_now: "Due now",
    upcoming: "Upcoming",
    months_short: "{n} mo",
    years_short: "{n} y",
    privacy_title: "Who can use what",
    privacy_sub: "Every change and every use of your data is written to a tamper-evident log that you can check yourself.",
    c_program_screening: "Program screening record",
    c_program_screening_d: "Needed for program reminders. Comes from Malaffi in a pilot.",
    c_genomic: "Genomic results",
    c_genomic_d: "Lets results such as BRCA or familial hypercholesterolemia raise priority.",
    c_wearables: "Wearable data",
    c_wearables_d: "Steps and sleep can raise priority and personalise tips.",
    c_share: "Share with family manager",
    c_share_d: "Lets the family manager see and book this person's reminders.",
    child_always: "Children's reminders are always shown to their guardian.",
    on: "On",
    off: "Off",
    log_title: "Data-use log",
    log_sub: "Append-only Merkle log (RFC 6962 hashing). Each entry has an inclusion proof against a signed checkpoint.",
    log_size: "Entries",
    log_root: "Root",
    log_sig: "Checkpoint signature",
    verify: "Verify log",
    verifying: "Verifying…",
    verified_ok: "Verified: {n} entries, every inclusion proof matches the signed root, and the log only grew since the last checkpoint.",
    verified_bad: "Verification failed: entry #{i} does not match the signed log. Someone changed it after it was written.",
    tamper: "Simulate tampering",
    restore: "Restore",
    tampered: "Entry #{i} was edited in this browser to show what verification catches.",
    sig_unavailable: "not available in this browser",
    entry: "Entry",
    purpose: "Purpose",
    actor: "By",
    data: "Data",
    on_device: "On this device",
    leaf: "leaf",
    tier: { 1: "Needs follow-up now", 2: "Higher priority", 3: "Overdue", 4: "Due now", 5: "Coming up" },
    status: {
      overdue: "Overdue", due: "Due now", due_soon: "Coming up", up_to_date: "Up to date", open_loop: "Follow-up open",
      recall: "Repeat needed", declined: "Postponed by you", not_eligible: "Not covered by IFHAS", uncertain: "Ask your doctor", info: "For your information",
    },
    role: { mother: "Mother", father: "Father", grandparent: "Grandfather", son: "Son", daughter: "Daughter" },
    age_y: "{n} years", age_m: "{n} months",
    insurance: { Thiqa: "Thiqa", Basic: "Basic", Enhanced: "Enhanced" },
    region: { "Abu Dhabi City": "Abu Dhabi City", "Al Ain": "Al Ain", "Al Dhafra": "Al Dhafra" },
    cat: {
      demographics: "Age and sex", screening_history: "Screening history", clinical: "Health conditions", family_history: "Family history",
      lifestyle: "Lifestyle", genomic: "Genomic (consented)", wearable: "Wearable (consented)", guideline: "Program standard",
    },
    // program view
    p_title: "Population screening, Abu Dhabi (synthetic)",
    p_sub: "{people} people in {hh} households · reference date {date}. All data are synthetic; numbers show how the tool works, not the real population.",
    k_gaps: "People with a care gap",
    k_open: "Open follow-ups",
    k_open_d: "Abnormal result without a completed referral",
    k_part: "IFHAS major package participation",
    k_part_d: "Target {t}%",
    k_ref: "Referrals on time",
    k_ref_d: "Target {t}%",
    c_part_title: "Participation by IFHAS package",
    c_part_sub: "Share of eligible members screened within the package interval. The line marks the {t}% target.",
    eligible_n: "{n} eligible",
    c_sim_title: "Same outreach capacity, different order",
    c_sim_sub: "{n} people contacted under every policy (30% of people with a gap). Open follow-ups closed within 90 days:",
    c_sim_note: "Most of the gain comes from putting clinical follow-ups first (+{a}). The model only orders people within the same clinical tier and adds little on top ({b} more completions). We show this so the program can decide whether the model is worth running.",
    policy: {
      "Broad invitation (random order)": "Broad invitation (random order)",
      "Age-first rule (oldest first)": "Age-first rule (oldest first)",
      "Clinical tier only (no model)": "Clinical tier only (no model)",
      "CareTrail prioritisation": "CareTrail prioritisation",
    },
    m_title: "Outreach model card",
    m_purpose: "Orders outreach within a clinical tier. Never shown to families. Not a clinical decision.",
    m_type: "Model", m_target: "Predicts", m_scored: "Scored", m_unscored: "Not scored (no invitation history)",
    m_auc: "AUC", m_brier: "Brier", m_ece: "Calibration error (ECE)",
    m_cal: "Calibration: predicted vs observed non-completion",
    m_pred: "Predicted", m_obs: "Observed",
    m_drivers: "Strongest factors",
    m_raises: "raises", m_lowers: "lowers",
    s_title: "Safeguards by group",
    s_sub: "Checked before every model release. Groups under {k} people are suppressed. A calibration gap over 5 points triggers local recalibration.",
    s_seg: "Group", s_n: "People", s_rec: "Prioritised", s_uptake: "Baseline uptake", s_gap: "Calibration gap", s_flag: "Status",
    s_ok: "OK", s_recal: "Recalibrate locally", s_supp: "Suppressed",
    q_title: "Outreach queue (pseudonymous)",
    q_sub: "Staff see pseudonyms, the gap and the suggested channel. Opening a record needs a purpose and is written to the data-use log.",
    q_who: "Person", q_gaps: "Gaps", q_risk: "Non-completion risk", q_why: "Main factors", q_how: "Channel", q_open: "Open record",
    q_interp: "Interpreter", q_nohist: "No history",
    open_title: "Open {p} for outreach",
    open_purpose: "Purpose of access",
    purpose_outreach: "Outreach to book an overdue screening",
    purpose_followup: "Close an open follow-up",
    purpose_quality: "Program quality review",
    open_confirm: "Open and log",
    opened: "Access logged as entry #{i}. The person can see it in their data-use log.",
    prog_log: "Program access log",
    assumptions: "Assumptions",
    channel: { app: "App", sms: "SMS", whatsapp: "WhatsApp", call: "Phone call", email: "Email" },
    language: { ar: "Arabic", en: "English", ur: "Urdu", tl: "Tagalog", hi: "Hindi", ml: "Malayalam", other: "Other" },
    // how it works
    h_title: "How CareTrail works",
    h_sub: "One rules engine, two views, one log.",
    h1_t: "Rules from the DoH standards",
    h1_b: "Every interval, age range and follow-up deadline comes from the IFHAS adult screening standard (July 2025) and the Well-Child Visit standard (Dec 2025), with the section cited on each reminder.",
    h2_t: "Family passport, on the device",
    h2_b: "The engine runs in the phone. It turns the family's record into next steps with plain reasons, and respects consent and postponement choices.",
    h3_t: "Program view for ADPHC",
    h3_b: "The same engine runs over the population. A simple, calibrated model orders outreach within each clinical tier; safeguards check every group before release.",
    h4_t: "Data-use log (FedTrail)",
    h4_b: "Every consent change, result and staff access is appended to a Merkle log with signed checkpoints, so families and auditors can verify who used what, and when.",
    h_data: "Data in a pilot: Malaffi (results), Sahatna (app channel), Thiqa (eligibility), wearables and genomics only with consent.",
    h_limits: "Not in this prototype: real patient data, immunizations (separate DoH schedule), booking integration, Urdu and Tagalog UI.",
    footer: "CareTrail prototype by team FedTrail for the Future Health Digital Innovation Challenge. Synthetic data. Not a medical device and not clinical advice.",
  },

  ar: {
    dir: "rtl",
    app_tag: "جواز الفحص للعائلة",
    synthetic: "نموذج أولي · بيانات اصطناعية فقط",
    view_family: "تطبيق العائلة",
    view_program: "لوحة البرنامج",
    view_how: "كيف يعمل",
    lang_switch: "English",
    demo_family: "عائلة تجريبية",
    tab_steps: "الخطوات التالية",
    tab_passport: "الجواز",
    tab_privacy: "الخصوصية",
    tab_log: "سجل البيانات",
    hello: "أهلًا بك يا {name}",
    you_manage: "أنت تدير التذكيرات الصحية لـ {n} أشخاص.",
    steps_title_n: "{n} خطوات لعائلتك هذا الشهر",
    steps_title_0: "لا شيء يحتاج انتباهك هذا الشهر",
    steps_sub: "مرتبة حسب الأهمية: المتابعات المفتوحة أولًا، ثم الفحوص الأعلى خطورة والمتأخرة.",
    more_steps: "{n} أخرى",
    fewer_steps: "عرض أقل",
    why: "لماذا؟",
    hide_why: "إخفاء",
    book: "احجز",
    not_now: "ليس الآن",
    booked: "تم طلب الحجز في {slot}",
    snoozed: "سنذكّرك مجددًا في {date}",
    undo: "تراجع",
    decision_population: "تذكير من البرنامج",
    decision_clinical: "القرار لطبيبك",
    clinical_note: "كير ترِيل لا يشخّص. هذا التذكير يتبع معيار البرنامج، والخطوة التالية تُقرَّر مع طبيبك.",
    factors: "ما الذي رفع الأولوية",
    no_factors: "تذكير روتيني: العمر والجنس وتواريخ الفحص فقط.",
    data_used: "البيانات المستخدمة",
    source: "مصدر القاعدة",
    components_at_visit: "في هذه الزيارة",
    book_title: "حجز: {title}",
    book_for: "لـ {name}",
    book_where: "عيادة مقترحة ضمن شبكة {insurance} (تجريبي)",
    book_pick: "اختر موعدًا",
    book_confirm: "اطلب الحجز",
    cancel: "إلغاء",
    snooze_title: "ليس الآن",
    snooze_30: "ذكّرني بعد 30 يومًا",
    snooze_decline: "لا أرغب في هذا الفحص",
    decline_note: "اختيارك مسجَّل ومحترم. لا تذكيرات لمدة 12 شهرًا، ويمكنك تغييره في أي وقت.",
    wellbeing_title: "من جهازك القابل للارتداء",
    wellbeing_shared: "تتم المشاركة بموافقتك، ويمكنك إيقافها من صفحة الخصوصية.",
    steps_day: "{n} خطوة يوميًا",
    sleep_h: "{n} ساعات نوم",
    wellbeing_tip: "التغييرات الصغيرة تساعد: مشي قصير بعد العشاء وموعد نوم ثابت. في التجربة الفعلية ترتبط هذه البطاقة بمواد التوعية المعتمدة من مركز أبوظبي للصحة العامة.",
    not_covered_title: "البالغون في هذه العائلة ليسوا من حاملي بطاقة ثقة",
    not_covered_body: "يشمل فحص إفحص للبالغين حاملي بطاقة ثقة، وتحدد شركة التأمين مزايا الوقاية لديك. زيارات الطفل السليم مغطاة للجميع.",
    lang_note_ur: "تفضّل هذه العائلة اللغة الأردية. تشير لوحة البرنامج إلى الحاجة لمترجم عند التواصل؛ واجهة هذا النموذج بالعربية والإنجليزية.",
    private_member: "{name} يحتفظ بفحوصه بشكل خاص",
    private_body: "{name} وحده يرى تذكيراته.",
    passport_title: "جواز العائلة",
    needs_action: "يحتاج إجراء",
    up_to_date: "محدّث",
    other: "أخرى",
    no_items: "لا توجد فحوص لهذا العمر.",
    visit_trail: "مسار زيارات الطفل السليم",
    attended: "تمت",
    missed: "فائتة",
    due_now: "مستحقة الآن",
    upcoming: "قادمة",
    months_short: "{n} شهر",
    years_short: "{n} س",
    privacy_title: "من يستخدم ماذا",
    privacy_sub: "كل تغيير وكل استخدام لبياناتك يُكتب في سجل مقاوم للتلاعب يمكنك التحقق منه بنفسك.",
    c_program_screening: "سجل فحوص البرنامج",
    c_program_screening_d: "لازم لتذكيرات البرنامج، ويأتي من منصة ملفّي في التجربة الفعلية.",
    c_genomic: "النتائج الجينية",
    c_genomic_d: "تسمح لنتائج مثل BRCA أو فرط كوليسترول الدم العائلي برفع الأولوية.",
    c_wearables: "بيانات الجهاز القابل للارتداء",
    c_wearables_d: "الخطوات والنوم قد ترفع الأولوية وتخصّص النصائح.",
    c_share: "المشاركة مع مدير العائلة",
    c_share_d: "تسمح لمدير العائلة برؤية تذكيرات هذا الشخص وحجزها.",
    child_always: "تذكيرات الأطفال تظهر دائمًا لولي الأمر.",
    on: "مفعّل",
    off: "متوقف",
    log_title: "سجل استخدام البيانات",
    log_sub: "سجل ميركل للإضافة فقط (تجزئة RFC 6962). لكل قيد إثبات تضمين مقابل نقطة تحقق موقّعة.",
    log_size: "القيود",
    log_root: "الجذر",
    log_sig: "توقيع نقطة التحقق",
    verify: "تحقق من السجل",
    verifying: "جارٍ التحقق…",
    verified_ok: "تم التحقق: {n} قيود، كل إثباتات التضمين تطابق الجذر الموقّع، والسجل لم يتغير إلا بالإضافة منذ آخر نقطة تحقق.",
    verified_bad: "فشل التحقق: القيد رقم {i} لا يطابق السجل الموقّع. تم تعديله بعد كتابته.",
    tamper: "محاكاة التلاعب",
    restore: "استعادة",
    tampered: "تم تعديل القيد رقم {i} في هذا المتصفح لإظهار ما يكشفه التحقق.",
    sig_unavailable: "غير متاح في هذا المتصفح",
    entry: "قيد",
    purpose: "الغرض",
    actor: "بواسطة",
    data: "البيانات",
    on_device: "على هذا الجهاز",
    leaf: "ورقة",
    tier: { 1: "تحتاج متابعة الآن", 2: "أولوية أعلى", 3: "متأخر", 4: "مستحق الآن", 5: "قريبًا" },
    status: {
      overdue: "متأخر", due: "مستحق الآن", due_soon: "قريبًا", up_to_date: "محدّث", open_loop: "متابعة مفتوحة",
      recall: "يلزم الإعادة", declined: "أجّلته بنفسك", not_eligible: "غير مشمول بإفحص", uncertain: "اسأل طبيبك", info: "للعلم",
    },
    role: { mother: "الأم", father: "الأب", grandparent: "الجد", son: "ابن", daughter: "ابنة" },
    age_y: "{n} سنة", age_m: "{n} شهر",
    insurance: { Thiqa: "ثقة", Basic: "الأساسي", Enhanced: "المعزّز" },
    region: { "Abu Dhabi City": "مدينة أبوظبي", "Al Ain": "العين", "Al Dhafra": "الظفرة" },
    cat: {
      demographics: "العمر والجنس", screening_history: "سجل الفحوص", clinical: "الحالات الصحية", family_history: "التاريخ العائلي",
      lifestyle: "نمط الحياة", genomic: "جينية (بموافقة)", wearable: "جهاز قابل للارتداء (بموافقة)", guideline: "معيار البرنامج",
    },
    p_title: "الفحص السكاني في أبوظبي (بيانات اصطناعية)",
    p_sub: "{people} شخصًا في {hh} أسرة · تاريخ المرجع {date}. جميع البيانات اصطناعية؛ الأرقام توضح طريقة عمل الأداة وليست السكان الفعليين.",
    k_gaps: "أشخاص لديهم فجوة رعاية",
    k_open: "متابعات مفتوحة",
    k_open_d: "نتيجة غير طبيعية دون تحويل مكتمل",
    k_part: "المشاركة في الحزمة الرئيسية لإفحص",
    k_part_d: "المستهدف {t}%",
    k_ref: "التحويلات في الوقت المحدد",
    k_ref_d: "المستهدف {t}%",
    c_part_title: "المشاركة حسب حزمة إفحص",
    c_part_sub: "نسبة المؤهلين الذين فُحصوا ضمن الفترة المحددة. الخط يمثل المستهدف {t}%.",
    eligible_n: "{n} مؤهل",
    c_sim_title: "نفس سعة التواصل، بترتيب مختلف",
    c_sim_sub: "تم التواصل مع {n} شخصًا في كل سياسة (30% ممن لديهم فجوة). المتابعات المفتوحة التي أُغلقت خلال 90 يومًا:",
    c_sim_note: "معظم المكسب يأتي من تقديم المتابعات السريرية أولًا (+{a}). النموذج يرتب الأشخاص داخل الفئة السريرية نفسها فقط ويضيف القليل ({b} فحوص مكتملة إضافية). نعرض ذلك ليقرر البرنامج إن كان النموذج يستحق التشغيل.",
    policy: {
      "Broad invitation (random order)": "دعوة عامة (ترتيب عشوائي)",
      "Age-first rule (oldest first)": "قاعدة العمر (الأكبر أولًا)",
      "Clinical tier only (no model)": "الفئة السريرية فقط (دون نموذج)",
      "CareTrail prioritisation": "أولويات كير ترِيل",
    },
    m_title: "بطاقة نموذج التواصل",
    m_purpose: "يرتب التواصل داخل الفئة السريرية. لا يُعرض على العائلات. ليس قرارًا سريريًا.",
    m_type: "النموذج", m_target: "يتنبأ بـ", m_scored: "تم تقييمهم", m_unscored: "دون تقييم (لا يوجد سجل دعوات)",
    m_auc: "AUC", m_brier: "Brier", m_ece: "خطأ المعايرة (ECE)",
    m_cal: "المعايرة: عدم الإكمال المتوقع مقابل الفعلي",
    m_pred: "المتوقع", m_obs: "الفعلي",
    m_drivers: "أقوى العوامل",
    m_raises: "يرفع", m_lowers: "يخفض",
    s_title: "الضمانات حسب الفئة",
    s_sub: "تُفحص قبل كل إصدار للنموذج. تُحجب الفئات الأقل من {k} أشخاص. فجوة معايرة تزيد على 5 نقاط تستدعي إعادة معايرة محلية.",
    s_seg: "الفئة", s_n: "الأشخاص", s_rec: "ذوو الأولوية", s_uptake: "الإقبال الأساسي", s_gap: "فجوة المعايرة", s_flag: "الحالة",
    s_ok: "سليم", s_recal: "إعادة معايرة محلية", s_supp: "محجوب",
    q_title: "قائمة التواصل (بأسماء مستعارة)",
    q_sub: "يرى الموظفون اسمًا مستعارًا والفجوة والقناة المقترحة. فتح السجل يتطلب غرضًا ويُكتب في سجل استخدام البيانات.",
    q_who: "الشخص", q_gaps: "الفجوات", q_risk: "خطر عدم الإكمال", q_why: "العوامل الرئيسية", q_how: "القناة", q_open: "فتح السجل",
    q_interp: "مترجم", q_nohist: "لا يوجد سجل",
    open_title: "فتح {p} للتواصل",
    open_purpose: "غرض الوصول",
    purpose_outreach: "التواصل لحجز فحص متأخر",
    purpose_followup: "إغلاق متابعة مفتوحة",
    purpose_quality: "مراجعة جودة البرنامج",
    open_confirm: "افتح وسجّل",
    opened: "تم تسجيل الوصول كقيد رقم {i}. يمكن للشخص رؤيته في سجل استخدام بياناته.",
    prog_log: "سجل وصول البرنامج",
    assumptions: "الافتراضات",
    channel: { app: "التطبيق", sms: "رسالة نصية", whatsapp: "واتساب", call: "اتصال هاتفي", email: "بريد إلكتروني" },
    language: { ar: "العربية", en: "الإنجليزية", ur: "الأردية", tl: "التاغالوغية", hi: "الهندية", ml: "المالايالامية", other: "أخرى" },
    h_title: "كيف يعمل كير ترِيل",
    h_sub: "محرك قواعد واحد، واجهتان، وسجل واحد.",
    h1_t: "قواعد من معايير دائرة الصحة",
    h1_b: "كل فترة وفئة عمرية وموعد متابعة مأخوذ من معيار إفحص لفحص البالغين (يوليو 2025) ومعيار زيارات الطفل السليم (ديسمبر 2025)، مع ذكر القسم في كل تذكير.",
    h2_t: "جواز العائلة على الجهاز",
    h2_b: "يعمل المحرك على الهاتف، ويحوّل سجل العائلة إلى خطوات تالية بأسباب واضحة، ويحترم الموافقات وخيارات التأجيل.",
    h3_t: "لوحة البرنامج لمركز أبوظبي للصحة العامة",
    h3_b: "المحرك نفسه يعمل على مستوى السكان. نموذج بسيط ومعاير يرتب التواصل داخل كل فئة سريرية، وتُفحص الضمانات لكل فئة قبل الإصدار.",
    h4_t: "سجل استخدام البيانات (FedTrail)",
    h4_b: "كل تغيير في الموافقة وكل نتيجة وكل وصول من الموظفين يُضاف إلى سجل ميركل بنقاط تحقق موقّعة، ليتحقق الأفراد والمدققون من هوية المستخدم وتوقيته.",
    h_data: "البيانات في التجربة الفعلية: ملفّي (النتائج)، صحتنا (قناة التطبيق)، ثقة (الأهلية)، والأجهزة القابلة للارتداء والبيانات الجينية بموافقة فقط.",
    h_limits: "خارج هذا النموذج: بيانات مرضى حقيقية، التطعيمات (جدول مستقل لدائرة الصحة)، الربط بأنظمة الحجز، وواجهة بالأردية والتاغالوغية.",
    footer: "نموذج كير ترِيل من فريق FedTrail لتحدي مستقبل الصحة للابتكار الرقمي. بيانات اصطناعية. ليس جهازًا طبيًا ولا استشارة سريرية.",
  },
};

// Names, packages, factors and reasons ------------------------------------------

export const NAMES_AR = {
  Mariam: "مريم", Khalid: "خالد", Saeed: "سعيد", Salma: "سلمى", Omar: "عمر",
  Ayesha: "عائشة", Imran: "عمران", Zain: "زين", Noura: "نورة", Hamad: "حمد", Fatima: "فاطمة",
  "Al Mansouri family": "عائلة المنصوري", "Khan family": "عائلة خان", "Al Dhaheri family": "عائلة الظاهري",
};

const PKG_AR = {
  major: "الحزمة الرئيسية للفحص الشامل", vision: "فحص النظر", hearing_dementia_50_64: "فحص السمع والذاكرة",
  hearing_dementia_65_75: "فحص السمع والذاكرة", oral: "فحص صحة الفم والأسنان", cervical_pap: "فحص سرطان عنق الرحم (مسحة)",
  cervical_hpv: "فحص سرطان عنق الرحم (فيروس الورم الحليمي)", breast_cbe: "فحص سرطان الثدي (فحص سريري)",
  breast_cbe_gail: "فحص سرطان الثدي (فحص سريري وتقييم الخطورة)", mammography: "تصوير الثدي الشعاعي (ماموغرام)",
  female_repro: "فحص الصحة الإنجابية للمرأة", male_repro: "فحص الصحة الإنجابية للرجل", colorectal: "فحص سرطان القولون والمستقيم",
  dexa: "قياس كثافة العظام", lung_ldct: "فحص سرطان الرئة (أشعة مقطعية منخفضة الجرعة)", aaa: "فحص تمدد الشريان الأبهر البطني",
  ifhas_eligibility: "الفحص الشامل (إفحص)", preconception: "استشارة ما قبل الحمل", genomic_review: "نتيجة جينية في ملفك",
  wcv_missed: "زيارات طفل سليم فائتة", idaq_18: "متابعة فحص النمو", cbc: "متابعة فقر الدم", hearing_infant: "فحص السمع (لم يكتمل عند الولادة)",
  bp_under3: "قياس ضغط الدم قبل عمر 3 سنوات",
};

const PKG_EN_SHORT = {
  major: "Major package", vision: "Vision", hearing_dementia_50_64: "Hearing & memory 50–64", hearing_dementia_65_75: "Hearing & memory 65–75",
  oral: "Oral health", cervical_pap: "Cervical (Pap)", cervical_hpv: "Cervical (HPV)", breast_cbe: "Breast exam",
  breast_cbe_gail: "Breast exam + risk", mammography: "Mammography", female_repro: "Female reproductive", male_repro: "Male reproductive",
  colorectal: "Colorectal", dexa: "Bone density", lung_ldct: "Lung (low-dose CT)", aaa: "Aortic aneurysm",
  cbc: "Anemia (CBC)", wcv_missed: "Missed child visits", hearing_infant: "Infant hearing",
  mchat_18: "Autism follow-up (18 mo)", mchat_24: "Autism follow-up (24 mo)", idaq_18: "Development follow-up",
  hearing_48: "Hearing follow-up", hearing_60: "Hearing follow-up", hearing_72: "Hearing follow-up",
};
const PKG_AR_SHORT = {
  major: "الحزمة الرئيسية", vision: "النظر", hearing_dementia_50_64: "السمع والذاكرة 50–64", hearing_dementia_65_75: "السمع والذاكرة 65–75",
  oral: "صحة الفم", cervical_pap: "عنق الرحم (مسحة)", cervical_hpv: "عنق الرحم (HPV)", breast_cbe: "فحص الثدي",
  breast_cbe_gail: "فحص الثدي والخطورة", mammography: "الماموغرام", female_repro: "الإنجابية للمرأة", male_repro: "الإنجابية للرجل",
  colorectal: "القولون والمستقيم", dexa: "كثافة العظام", lung_ldct: "الرئة (أشعة منخفضة الجرعة)", aaa: "تمدد الأبهر",
  cbc: "فقر الدم", wcv_missed: "زيارات أطفال فائتة", hearing_infant: "سمع الرضيع",
  mchat_18: "متابعة التوحد (18 شهرًا)", mchat_24: "متابعة التوحد (24 شهرًا)", idaq_18: "متابعة النمو",
  hearing_48: "متابعة السمع", hearing_60: "متابعة السمع", hearing_72: "متابعة السمع",
};

export function arAge(months) {
  if (months < 24 || months % 12) {
    if (months === 1) return "شهر واحد";
    if (months === 2) return "شهرين";
    return months <= 10 ? `${months} أشهر` : `${months} شهرًا`;
  }
  const y = months / 12;
  if (y === 2) return "سنتين";
  return `${y} سنوات`;
}
const enAge = (m) => (m < 24 || m % 12 ? `${m}-month` : `${m / 12}-year`);

export function pkgShort(key, lang) {
  const wcv = /^wcv_(\d+)$/.exec(key);
  if (wcv) return lang === "ar" ? `زيارة ${arAge(+wcv[1])}` : `${enAge(+wcv[1])} visit`;
  return (lang === "ar" ? PKG_AR_SHORT : PKG_EN_SHORT)[key] || key;
}

export function itemTitle(item, lang) {
  if (lang !== "ar") return item.title;
  const k = item.key;
  let m;
  if ((m = /^wcv_(\d+)$/.exec(k))) return `زيارة الطفل السليم بعمر ${arAge(+m[1])}`;
  if ((m = /^mchat_(\d+)$/.exec(k))) return `متابعة فحص التوحد (بعمر ${arAge(+m[1])})`;
  if (/^hearing_\d+$/.test(k)) return "متابعة السمع";
  return PKG_AR[k] || item.title;
}

const FACTOR_AR = {
  cond_diabetes: "السكري", cond_hypertension: "ارتفاع ضغط الدم", cond_high_cholesterol: "ارتفاع الكوليسترول", cond_obesity: "السمنة",
  cond_copd: "مرض الانسداد الرئوي المزمن", cond_type1_diabetes: "السكري من النوع الأول", premature: "ولادة مبكرة",
  fh_diabetes: "تاريخ عائلي للسكري", fh_hypertension: "تاريخ عائلي لارتفاع ضغط الدم", fh_heart_disease: "تاريخ عائلي لأمراض القلب",
  fh_cancer: "تاريخ عائلي للسرطان", tobacco_current: "استخدام التبغ حاليًا", tobacco_former: "استخدام سابق للتبغ",
  lung_high_risk: "يستوفي معايير إفحص لخطورة التدخين العالية", gen_brca: "نتيجة جينية: متغير BRCA1/2 (بموافقتك)",
  gen_lynch: "نتيجة جينية: متلازمة لينش (بموافقتك)", gen_fh: "نتيجة جينية: فرط كوليسترول الدم العائلي (بموافقتك)",
  wear_low_steps: "عدد خطوات يومي منخفض من جهازك", wear_short_sleep: "متوسط نوم قصير من جهازك",
  never_screened: "لا يوجد سجل لهذا الفحص", long_overdue: "متأخر أكثر من سنة", dev_screening: "تشمل فحص النمو والتوحد",
  newborn_hearing_missed: "لم يكتمل فحص السمع عند الولادة",
};
export const factorText = (f, lang) => (lang === "ar" ? FACTOR_AR[f.code] || f.text : f.text);

const SPEC_AR = {
  "Family physician / internal medicine": "طبيب الأسرة / الطب الباطني", Ophthalmologist: "طبيب العيون", Dentist: "طبيب الأسنان",
  "ENT or neurologist": "أخصائي الأنف والأذن والحنجرة أو الأعصاب", "ENT or geriatrician": "أخصائي الأنف والأذن والحنجرة أو طب المسنين",
  Gynecologist: "طبيب النساء", "Family physician or gynecologist": "طبيب الأسرة أو طبيب النساء",
  "Family medicine, gynecology or breast surgery": "طب الأسرة أو النساء أو جراحة الثدي", Urologist: "طبيب المسالك البولية",
  Gastroenterologist: "طبيب الجهاز الهضمي", "Endocrinologist or family physician": "طبيب الغدد الصماء أو طبيب الأسرة",
  Pulmonologist: "طبيب الأمراض الصدرية", "Vascular surgeon": "جراح الأوعية الدموية",
  "Child neurodevelopment clinic and speech therapy": "عيادة النمو العصبي للأطفال وعلاج النطق",
  "Pediatric neurologist or neurodevelopment clinic": "طبيب أعصاب الأطفال أو عيادة النمو العصبي",
  Pediatrician: "طبيب الأطفال", "ENT / audiology": "الأنف والأذن والحنجرة / السمعيات", "Your doctor": "طبيبك",
};
const LIMIT_AR = { "15 working days": "15 يوم عمل", "4 weeks": "4 أسابيع", "2 weeks": "أسبوعين", "7 days": "7 أيام" };
const FINDING_AR = {
  "Familial hypercholesterolemia": "فرط كوليسترول الدم العائلي", "BRCA1/2 pathogenic variant": "متغير ممرض في BRCA1/2", "Lynch syndrome": "متلازمة لينش",
};
const COMP_AR = {
  growth: "قياس النمو (مؤشرات منظمة الصحة العالمية)", head_circumference: "محيط الرأس", development: "مراقبة النمو (4 مجالات)",
  vision: "فحص النظر", ddh_maneuvers: "فحص الورك: أورتولاني وبارلو", ddh_signs: "فحص الورك: التبعيد وطول الطرف وثنيات الجلد",
  hearing_infant: "فحص السمع إن فات أو لم ينجح عند الولادة", hearing_pta: "فحص السمع بالنغمة الصافية", cbc: "فحص فقر الدم (تعداد الدم الكامل)",
  oral: "فحص الفم لدى طبيب أو أخصائي أسنان", blood_pressure: "ضغط الدم", mchat_r: "فحص التوحد (M-CHAT-R)", idaq: "استبيان تقييم النمو المرحلي (IDAQ)",
};
export const compText = (c, lang) => (lang === "ar" ? COMP_AR[c.id] || c.name : c.name);

const DRIVER_AR = {
  "Number of young children in household": "عدد الأطفال الصغار في الأسرة", "Lives in Al Dhafra": "يقيم في الظفرة", Male: "ذكر",
  "Has a chronic condition": "لديه حالة مزمنة", "Past invitation response rate": "معدل الاستجابة للدعوات السابقة", "Prefers SMS": "يفضّل الرسائل النصية",
  "Preferred language not Arabic or English": "اللغة المفضلة ليست العربية أو الإنجليزية", "Prefers WhatsApp": "يفضّل واتساب",
  "Prefers phone calls": "يفضّل الاتصال الهاتفي", "Child (Well-Child programme)": "طفل (برنامج الطفل السليم)", "Aged 18-29": "العمر 18–29",
  "In employment": "يعمل", Retired: "متقاعد", "Declines in the past 12 months": "رفض خلال آخر 12 شهرًا", "Aged 60-75": "العمر 60–75",
  "Lives in Al Ain": "يقيم في العين", "Thiqa member": "من حاملي بطاقة ثقة", "Missed appointments in 3 years": "مواعيد فائتة خلال 3 سنوات",
};
export const driverText = (s, lang) => (lang === "ar" ? DRIVER_AR[s] || s : s);

const SEG_AR = {
  "Age band": "الفئة العمرية", Nationality: "الجنسية", "Preferred language": "اللغة المفضلة", Region: "المنطقة", "Sex (adults)": "الجنس (البالغون)",
  child: "أطفال", Expatriate: "مقيم", "UAE national": "مواطن", Arabic: "العربية", English: "الإنجليزية", Other: "أخرى",
  "Abu Dhabi City": "مدينة أبوظبي", "Al Ain": "العين", "Al Dhafra": "الظفرة", female: "إناث", male: "ذكور",
};
const SEG_EN = { child: "Children", female: "Female", male: "Male" };
export const segText = (s, lang) => (lang === "ar" ? SEG_AR[s] || s : SEG_EN[s] || s);

export function reasonText(r, lang, fmtDate) {
  const D = (x) => (x ? fmtDate(x) : "");
  const sp = (s) => (lang === "ar" ? SPEC_AR[s] || s : s);
  if (lang === "ar") {
    switch (r.code) {
      case "never_screened": return "لا يوجد سجل لهذا الفحص بعد.";
      case "due_since": return `مستحق منذ ${D(r.date)}.`;
      case "due_on": return `مستحق في ${D(r.date)}.`;
      case "next_due": return `الموعد القادم ${D(r.date)}.`;
      case "elevated_risk": return "أولوية أعلى بسبب العوامل أدناه.";
      case "declined": return `اخترت التأجيل في ${D(r.date)}. لا تذكيرات حتى ${D(r.until)}.`;
      case "insufficient_result": return `تعذّرت قراءة نتيجة ${D(r.date)}، لذا يدعوك البرنامج للإعادة.`;
      case "abnormal_no_referral": return `نتيجة ${D(r.date)} تحتاج متابعة مع ${sp(r.specialist)}؛ يُتوقع التحويل خلال ${LIMIT_AR[r.limit] || r.limit}.`;
      case "referral_not_completed": return `التحويل إلى ${sp(r.specialist)} بتاريخ ${D(r.date)} لم يُسجَّل له موعد مكتمل بعد.`;
      case "not_thiqa": return `يشمل برنامج إفحص حاملي بطاقة ثقة. خطتك (${STR.ar.insurance[r.insurance] || r.insurance}) تحدد مزايا الوقاية لديك.`;
      case "insufficient_data": return "لا تتوفر بيانات كافية للقرار (ناقص: تاريخ التدخين). اسأل طبيبك.";
      case "preconception": return "تخططين للحمل؟ يمكنك طلب زيارة ما قبل الحمل.";
      case "genomic_review": return `${FINDING_AR[r.finding] || r.finding}: يتحدد أثر هذه النتيجة على فحوصك مع طبيبك.`;
      case "missed_visits": return `زيارات فائتة بعمر ${r.months.map(arAge).join("، ")}. زيارات التعويض مغطاة.`;
      case "visit_due": return `هذه الزيارة مستحقة الآن حتى ${D(r.until)}.`;
      case "newborn_hearing": return "لم يكتمل فحص السمع عند الولادة؛ يجب إجراؤه في أقرب وقت.";
      case "bp_under3": return "بسبب حالة صحية، يجب قياس ضغط الدم في الزيارات قبل عمر 3 سنوات.";
      case "done_once": return `أُجري في ${D(r.date)}؛ يلزم مرة واحدة فقط.`;
      default: return r.code;
    }
  }
  switch (r.code) {
    case "never_screened": return "No record of this screening yet.";
    case "due_since": return `Due since ${D(r.date)}.`;
    case "due_on": return `Due on ${D(r.date)}.`;
    case "next_due": return `Next due ${D(r.date)}.`;
    case "elevated_risk": return "Higher priority because of the factors below.";
    case "declined": return `You chose to postpone on ${D(r.date)}. No reminders until ${D(r.until)}.`;
    case "insufficient_result": return `The result from ${D(r.date)} could not be read, so the program recalls you.`;
    case "abnormal_no_referral": return `The result from ${D(r.date)} needs follow-up with ${sp(r.specialist)}. A referral is expected within ${r.limit}.`;
    case "referral_not_completed": return `Referral to ${sp(r.specialist)} made on ${D(r.date)} has no completed visit yet.`;
    case "not_thiqa": return `IFHAS covers Thiqa members. Your plan (${r.insurance}) sets your preventive benefits.`;
    case "insufficient_data": return `Not enough data to decide (missing: ${r.missing}). Ask your doctor.`;
    case "preconception": return "Planning a pregnancy? You can ask for a preconception visit.";
    case "genomic_review": return `${r.finding}: what this means for your screening is decided with your doctor.`;
    case "missed_visits": return `Missed visit${r.months.length > 1 ? "s" : ""} at ${r.months.join(", ")} months. Catch-up visits are covered.`;
    case "visit_due": return `This visit is due now, until ${D(r.until)}.`;
    case "newborn_hearing": return "The newborn hearing test was not completed. It should be done as soon as possible.";
    case "bp_under3": return "Because of a health condition, blood pressure should be checked at visits before age 3.";
    case "done_once": return `Done on ${D(r.date)}; needed only once.`;
    default: return r.code;
  }
}
