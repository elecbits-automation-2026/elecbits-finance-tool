import { useState } from "react";
import { RotateCcw, Wallet, AlertTriangle, FileSignature, Edit3, Target, BedDouble, Clock } from "lucide-react";
import { EXPENSE_TYPES, NON_PROJECT_DEPTS, VP_THRESHOLD, CEO_THRESHOLD, TRAVEL_EXPENSE_IDS, TRAVEL_MIN_LEAD_DAYS, accommodationDailyCap } from "../constants";
import { isReadOnly } from "../lib/access";
import { getEligibleDeptApprovers, needsBoxBuildMidApproval, getStageLabel, computeNextStage } from "../lib/workflow";
import { getRoster } from "../lib/roster";
import { getActiveBudgetForProject, getActiveMonthlyBudget, getMonthlyBudgetUsage, getApprovedPOsForProject, getApprovedPOsForDept, getPOUsage, getPOAvailable, getProjectSpend } from "../lib/finance";
import { CurrencyInput } from "../components/CurrencyInput";
import { AttachmentInput } from "../components/AttachmentInput";
import { FlowPreview } from "../components/FlowPreview";
import { TravelFields } from "./TravelFields";
import { uploadAttachment } from "../lib/storage";

// ============ NEW PAYMENT REQUEST FORM ============
export function NewPaymentRequestForm({ user, requests, budgets, pos, saveRequests, onSuccess, resubmitFrom = null }) {
  const [form, setForm] = useState(resubmitFrom ? {
    expenseTypeId: resubmitFrom.expenseTypeId,
    projectId: resubmitFrom.projectId || "",
    vendor: resubmitFrom.vendor || "",
    description: resubmitFrom.description || "",
    purpose: resubmitFrom.purpose || "",
    amount: resubmitFrom.amount || "",
    currency: resubmitFrom.currency || "INR",
    fxRate: resubmitFrom.fxRate || 1,
    travelFrom: resubmitFrom.travel?.fromLocation ?? resubmitFrom.travelFrom ?? "",
    travelTo: resubmitFrom.travel?.toLocation ?? resubmitFrom.travelTo ?? "",
    place: resubmitFrom.travel?.place ?? "",
    travelStart: resubmitFrom.travel?.startDate || resubmitFrom.travel?.checkIn || "",
    travelEnd: resubmitFrom.travel?.endDate || resubmitFrom.travel?.checkOut || "",
    urgencyJustification: "", overshootJustification: "", accomCapJustification: "",
    invoiceNumber: resubmitFrom.invoiceNumber || "",
    pnr: resubmitFrom.travel?.pnr ?? "",
    linkedTripId: resubmitFrom.travel?.linkedTripId ?? "",
    selectedApproverIds: [],
    attachment: null,
    linkedPOId: resubmitFrom.linkedPOId || "",
  } : {
    expenseTypeId: "", projectId: "", vendor: "", description: "", purpose: "",
    amount: "", currency: "INR", fxRate: 1,
    travelFrom: "", travelTo: "", place: "", travelStart: "", travelEnd: "",
    urgencyJustification: "", overshootJustification: "", accomCapJustification: "", invoiceNumber: "", pnr: "", linkedTripId: "",
    selectedApproverIds: [], attachment: null, linkedPOId: "",
  });
  const rt = resubmitFrom?.travel?.subType === "Travel" ? resubmitFrom.travel : null;
  const [tf, setTf] = useState({
    fullName: rt?.fullName || user.name || "",
    contactNumber: rt?.contactNumber || "",
    email: rt?.email || user.email || "",
    tripType: rt?.tripType || "Round Trip",
    departureCity: rt?.departureCity || "",
    arrivalCity: rt?.arrivalCity || "",
    departureDate: rt?.departureDate || "",
    departureFlightTime: rt?.departureFlightTime || "",
    returnDate: rt?.returnDate || "",
    returnFlightTime: rt?.returnFlightTime || "",
    reasons: rt?.reasons || [],
    reasonOther: rt?.reasonOther || "",
    isEmergency: rt?.isEmergency || "No",
    emergencyReason: rt?.emergencyReason || "",
    meetingsCount: rt?.meetings != null ? String(rt.meetings.length) : (rt?.meetingsCount != null ? String(rt.meetingsCount) : ""),
    meetings: rt?.meetings ? rt.meetings.map(m => ({ orgName: m.orgName || "", meetingWith: m.meetingWith || "" })) : [],
    peopleCount: rt?.travellers != null ? String(rt.travellers.length) : "",
    travellers: rt?.travellers ? rt.travellers.map(t => ({ name: t.name || t.fullName || "", age: String(t.age ?? ""), sex: t.sex || "" })) : [],
    desiredOutcomes: rt?.desiredOutcomes || "",
  });
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ackPending, setAckPending] = useState(false);
  // Split one supplier payment across multiple same-department projects, each
  // drawn against its own budget (for accurate per-project spend reporting).
  const [splitMode, setSplitMode] = useState(false);
  const [splits, setSplits] = useState([{ projectId: "", amount: "", linkedPOId: "" }, { projectId: "", amount: "", linkedPOId: "" }]);

  const selectedType = EXPENSE_TYPES.find(t => t.id === form.expenseTypeId);
  const isProject = selectedType?.requiresProject || false;
  const isTravelType = !!selectedType && TRAVEL_EXPENSE_IDS.includes(selectedType.id);
  const isAccommodation = selectedType?.id === "AC";
  const poolName = selectedType ? (selectedType.pool || selectedType.name) : null;
  const isVendorPayment = selectedType?.name.includes("Vendor Payment");
  const singleAmountINR = form.currency === "INR" ? parseFloat(form.amount || 0) : parseFloat(form.amount || 0) * parseFloat(form.fxRate || 0);
  // Projects eligible for a split: active project budgets in the raiser's own
  // department (split is single-department by design → one approval chain).
  const splitProjects = budgets.filter(b => b.type === "Project" && b.dept === user.dept && (b.status === "Active" || b.currentStage === "Active"));
  const splitTotalINR = splits.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const useSplit = isProject && splitMode;
  const amountINR = useSplit ? splitTotalINR : singleAmountINR;
  function projAvailable(projectId) {
    const b = getActiveBudgetForProject(budgets, projectId);
    return b ? Math.max(0, b.amountINR - getProjectSpend(requests, projectId).total) : 0;
  }
  function setSplitRow(i, patch) { setSplits(splits.map((r, idx) => idx === i ? { ...r, ...patch } : r)); }

  // Segregation of duties: never route a request to its own raiser (e.g. a dept head
  // raising their own request), so drop the raiser from the eligible set. If that
  // leaves no in-department approver (a sole head), the dept stage is skipped and the
  // request escalates to the next authority (Finance Head / VP) — see initialStage.
  const eligibleApprovers = getEligibleDeptApprovers(user, selectedType, isProject).filter(a => a.id !== user.id);
  const needsMid = needsBoxBuildMidApproval(user);
  const soleHead = !needsMid && eligibleApprovers.length === 0;
  const isOdmProject = user.dept === "ODM" && isProject && user.role === "Employee";
  const isMultiApprover = eligibleApprovers.length > 1;

  const activeBudgets = budgets.filter(b => b.type === "Project" && (b.status === "Active" || b.currentStage === "Active"));
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthlyBudget = (!isProject && selectedType) ? getActiveMonthlyBudget(budgets, user.dept, poolName, currentMonth) : null;
  const monthlyUsage = monthlyBudget ? getMonthlyBudgetUsage(requests, user.dept, poolName, currentMonth) : null;
  const monthlyAvailable = monthlyBudget ? Math.max(0, monthlyBudget.amountINR - monthlyUsage.total) : 0;
  const isOvershoot = !isProject && !!monthlyBudget && amountINR > monthlyAvailable;

  // Urgency: trips starting within TRAVEL_MIN_LEAD_DAYS need a justification.
  const todayISO = new Date().toISOString().slice(0, 10);
  const travelStartRef = isTravelType ? (isAccommodation ? form.travelStart : tf.departureDate) : "";
  const leadDays = travelStartRef ? Math.round((new Date(travelStartRef + "T00:00:00") - new Date(todayISO + "T00:00:00")) / 86400000) : null;
  const isShortNotice = isTravelType && leadDays != null && leadDays < TRAVEL_MIN_LEAD_DAYS;

  // Accommodation per-night cap by the raiser's role. Total stay must be within
  // cap × nights (nights = check-out − check-in).
  const accomCap = accommodationDailyCap(user.role);
  const accomNights = (isAccommodation && form.travelStart && form.travelEnd && form.travelEnd > form.travelStart)
    ? Math.round((new Date(form.travelEnd + "T00:00:00") - new Date(form.travelStart + "T00:00:00")) / 86400000) : 0;
  const accomMax = accomNights * accomCap;
  const accomOverCap = isAccommodation && accomNights > 0 && amountINR > accomMax;

  // Optional cross-link: connect the Travel and Accommodation raised for the same trip.
  const tripLabel = (x) => {
    const t = x.travel || {};
    const where = t.subType === "Accommodation" ? (t.place || "") : [t.departureCity || t.fromLocation, t.arrivalCity || t.toLocation].filter(Boolean).join(" → ");
    return `${t.subType} · ${x.id}${where ? ` · ${where}` : ""}`;
  };
  const linkCounterpart = isAccommodation ? "Travel" : "Accommodation";
  const linkTargets = isTravelType
    ? requests.filter(x => x.requesterId === user.id && x.travel?.subType === linkCounterpart && x.id !== resubmitFrom?.id && !["Rejected", "Cancelled"].includes(x.status))
        .sort((a, b) => +new Date(b.createdDate) - +new Date(a.createdDate)).slice(0, 25)
    : [];

  // Completed trips (Paid) by this user with no Travel Outcome Form yet. Raising
  // another Travel entry requires acknowledging a disclaimer about them.
  const pendingOutcomes = requests.filter(x => x.requesterId === user.id && x.travel?.subType === "Travel" && x.status === "Paid" && !x.postTravel);
  const hasPendingOutcomes = isTravelType && !isAccommodation && pendingOutcomes.length > 0;

  const projectPOs = isProject && form.projectId ? getApprovedPOsForProject(pos, form.projectId) : [];
  const deptPOs = !isProject && selectedType ? getApprovedPOsForDept(pos, user.dept) : [];
  const linkedPO = form.linkedPOId ? pos.find(p => p.id === form.linkedPOId) : null;
  const poUsage = linkedPO ? getPOUsage(requests, linkedPO.id) : null;
  const poAvailable = linkedPO ? getPOAvailable(linkedPO, requests) : 0;

  // Check if linked PO has a pending edit request
  function hasPendingEdit(poId) {
    return pos.some(p => p.type === "POEdit" && p.editingPOId === poId && !["Approved", "Rejected", "Cancelled"].includes(p.status));
  }
  const linkedPOHasPendingEdit = linkedPO ? hasPendingEdit(linkedPO.id) : false;

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setErr("File too large. Max 2MB."); return; }
    try {
      const att = await uploadAttachment(file);
      setForm(f => ({ ...f, attachment: att }));
      setErr("");
    } catch (err) {
      setErr("Upload failed: " + (err?.message || "please try again"));
    }
  }

  async function submit() {
    setErr("");
    if (isReadOnly(user)) return setErr("Your account is read-only and cannot raise requests.");
    if (!user.dept) return setErr("Your account has no department assigned. Ask an admin to set your department before raising requests.");
    if (!form.expenseTypeId) return setErr("Select expense type");
    if (!isTravelType && !form.description.trim()) return setErr("Description required");
    if ((!useSplit && !form.amount) || amountINR <= 0) return setErr(useSplit ? "Add at least one project with an amount to the split" : "Valid amount required");
    if (form.currency !== "INR" && (!form.fxRate || parseFloat(form.fxRate) <= 0)) return setErr("Valid FX rate required");
    // Guard against paying the same invoice twice.
    if (form.invoiceNumber.trim()) {
      const inv = form.invoiceNumber.trim().toLowerCase();
      const dupInv = requests.find(r => r.kind === "Payment" && r.id !== resubmitFrom?.id && (r.invoiceNumber || "").trim().toLowerCase() === inv && !["Rejected", "Cancelled"].includes(r.status));
      if (dupInv) return setErr(`Invoice "${form.invoiceNumber.trim()}" is already on payment ${dupInv.id} (${dupInv.status}). Check before raising a duplicate.`);
    }
    if (isProject && !useSplit && !form.projectId) return setErr("Project ID required");
    if (!isProject && !isTravelType && !form.purpose.trim()) return setErr("Purpose mandatory");
    if (!form.attachment) return setErr("Attachment is mandatory");

    let selectedApproverIds = [];
    if (isOdmProject) selectedApproverIds = eligibleApprovers.map(a => a.id);
    else if (isMultiApprover) {
      if (form.selectedApproverIds.length === 0) return setErr("Select an approver");
      selectedApproverIds = form.selectedApproverIds;
    } else if (eligibleApprovers.length === 1) selectedApproverIds = [eligibleApprovers[0].id];

    let splitRows = [];
    if (isProject && !useSplit) {
      const budget = getActiveBudgetForProject(budgets, form.projectId);
      if (!budget) return setErr("No active budget for this project. Raise a budget request first.");
      const available = Math.max(0, budget.amountINR - getProjectSpend(requests, form.projectId).total);
      if (available - amountINR < 0) return setErr(`Exceeds project budget. Available: ₹${(available / 100000).toFixed(2)}L.`);
      if (!form.linkedPOId) return setErr("PO is mandatory for project payments. Select an approved PO.");
    } else if (useSplit) {
      // One supplier payment split across multiple same-department projects, each
      // drawn against its own budget AND its own approved PO.
      // Reject partially-filled rows — otherwise an unvalidated row would inflate
      // the total past what gets checked. After this, total === sum of valid rows.
      const started = r => !!r.projectId || parseFloat(r.amount) > 0 || !!r.linkedPOId;
      const complete = r => !!r.projectId && parseFloat(r.amount) > 0 && !!r.linkedPOId;
      if (splits.some(r => started(r) && !complete(r))) return setErr("Each split row needs a project, an amount, and an approved PO.");
      splitRows = splits.filter(complete);
      if (splitRows.length < 2) return setErr("Add at least two projects to split this payment across.");
      const ids = splitRows.map(r => r.projectId);
      if (new Set(ids).size !== ids.length) return setErr("Each project can appear only once in the split.");
      for (const r of splitRows) {
        const amt = parseFloat(r.amount);
        const budget = getActiveBudgetForProject(budgets, r.projectId);
        if (!budget) return setErr(`No active budget for ${r.projectId}.`);
        if (budget.dept !== user.dept) return setErr("All split projects must be in your department.");
        const availBudget = Math.max(0, budget.amountINR - getProjectSpend(requests, r.projectId).total);
        if (amt > availBudget) return setErr(`${r.projectId}: exceeds available budget (₹${(availBudget / 100000).toFixed(2)}L).`);
        const po = pos.find(p => p.id === r.linkedPOId);
        if (!po) return setErr(`${r.projectId}: selected PO not found.`);
        if (po.projectId !== r.projectId) return setErr(`${r.projectId}: the selected PO belongs to a different project.`);
        if (po.status === "Cancelled") return setErr(`${r.projectId}: the selected PO is cancelled.`);
        const availPO = getPOAvailable(po, requests);
        if (amt > availPO) return setErr(`${r.projectId}: exceeds PO ${po.poNumber} available (₹${(availPO / 100000).toFixed(2)}L).`);
      }
    }

    if (isTravelType && isAccommodation) {
      if (!form.place.trim()) return setErr("Accommodation location is required");
      if (!form.travelStart || !form.travelEnd) return setErr("Check-in and check-out dates are required");
      if (form.travelEnd < form.travelStart) return setErr("Check-out cannot be before check-in");
      if (accomOverCap && !form.accomCapJustification.trim()) return setErr(`Accommodation exceeds your cap (₹${accomCap.toLocaleString("en-IN")}/night × ${accomNights} = ₹${accomMax.toLocaleString("en-IN")} max). Add a justification to override.`);
      if (isShortNotice && !form.urgencyJustification.trim()) return setErr(`This starts in ${leadDays} day(s) — under the ${TRAVEL_MIN_LEAD_DAYS}-day notice. Add an urgency justification.`);
    } else if (isTravelType) {
      if (!tf.fullName.trim() || !tf.contactNumber.trim() || !tf.email.trim()) return setErr("Full name, contact number and email are required");
      if (!tf.departureCity.trim() || !tf.arrivalCity.trim()) return setErr("Departure and arrival cities are required");
      if (!tf.departureDate) return setErr("Departure date is required");
      if (tf.tripType === "Round Trip") {
        if (!tf.returnDate) return setErr("Return date is required for a round trip");
        if (tf.returnDate < tf.departureDate) return setErr("Return date cannot be before departure date");
      }
      if (tf.reasons.length === 0) return setErr("Select at least one reason for travelling");
      if (tf.reasons.includes("Other") && !tf.reasonOther.trim()) return setErr("Please specify the other reason for travelling");
      if (isShortNotice && !tf.emergencyReason.trim()) return setErr(`This starts in ${leadDays} day(s) — explain the reason for emergency travel.`);
      if (!String(tf.meetingsCount).trim()) return setErr("Number of meetings aligned is required");
      if (tf.meetings.some(m => !m.orgName.trim())) return setErr("Each meeting needs an organisation name");
      if (!String(tf.peopleCount).trim()) return setErr("Number of people travelling is required (enter 0 if travelling alone)");
      if (tf.travellers.some(t => !t.name.trim() || !String(t.age).trim() || !t.sex)) return setErr("Each additional traveller needs a name, age and sex");
      if (!tf.desiredOutcomes.trim()) return setErr("Desired outcomes are required");
      if (hasPendingOutcomes && !ackPending) return setErr("You have pending Travel Outcome Form(s). Tick the disclaimer to proceed.");
    }

    if (!isProject && selectedType) {
      if (!monthlyBudget) return setErr(`No active Monthly Budget for ${user.dept} → ${poolName} for ${currentMonth}. Ask Dept Head to raise one first.`);
      if (amountINR > monthlyAvailable) {
        // Travel may exceed its pool WITH a justification; all other expenses are hard-blocked.
        if (isTravelType) { if (!form.overshootJustification.trim()) return setErr(`This exceeds the ${poolName} pool (available ₹${(monthlyAvailable / 1000).toFixed(1)}K). Add an over-budget justification to proceed.`); }
        else return setErr(`Exceeds Monthly Budget pool. Available: ₹${(monthlyAvailable / 1000).toFixed(1)}K.`);
      }
    }

    if (form.linkedPOId) {
      const po = pos.find(p => p.id === form.linkedPOId);
      if (!po) return setErr("Selected PO not found.");
      if (po.status === "Cancelled") return setErr("This PO has been cancelled.");
      const avail = getPOAvailable(po, requests);
      if (amountINR > avail) return setErr(`Exceeds PO available balance. PO ${po.poNumber} available: ₹${(avail / 100000).toFixed(2)}L.`);
    }

    setSubmitting(true);
    const now = new Date().toISOString();
    // Sole head raising their own request: skip the dept stage (they can't self-approve)
    // and escalate to the next authority — Finance Head raiser -> VP, everyone else ->
    // the workflow's next stage after DeptApproval (Finance Head).
    const initialStage = needsMid
      ? "BoxBuildMid"
      : (soleHead
          ? (user.role === "FinanceHead" ? "VP" : computeNextStage({ kind: "Payment", amountINR }, "DeptApproval", null))
          : "DeptApproval");
    const linkedPOInfo = form.linkedPOId ? pos.find(p => p.id === form.linkedPOId) : null;
    // Documented per-project breakdown for the spend report.
    const splitData = useSplit ? splitRows.map(r => {
      const b = getActiveBudgetForProject(budgets, r.projectId);
      const po = pos.find(p => p.id === r.linkedPOId);
      return { projectId: r.projectId, projectName: b?.projectName || r.projectId, amountINR: parseFloat(r.amount), linkedPOId: r.linkedPOId, linkedPONumber: po?.poNumber || null };
    }) : undefined;

    // Travel/Accommodation sub-object + auto-generated description/purpose (travel has
    // its own field set, so the generic Description/Purpose inputs are hidden for it).
    const travelReasonText = tf.reasons.filter(r => r !== "Other").concat(tf.reasons.includes("Other") && tf.reasonOther.trim() ? [tf.reasonOther.trim()] : []).join(", ");
    const linkedTarget = form.linkedTripId ? requests.find(x => x.id === form.linkedTripId) : null;
    const travelObj = !isTravelType ? undefined : (isAccommodation ? {
      subType: "Accommodation",
      linkedTripId: form.linkedTripId || "", linkedTripLabel: linkedTarget ? tripLabel(linkedTarget) : "",
      place: form.place, checkIn: form.travelStart, checkOut: form.travelEnd,
      dailyCap: accomCap, nights: accomNights,
      capOverrideJustification: accomOverCap ? form.accomCapJustification.trim() : "",
      leadDays, urgent: isShortNotice,
      urgencyJustification: isShortNotice ? form.urgencyJustification.trim() : "",
      overshootJustification: isOvershoot ? form.overshootJustification.trim() : "",
    } : {
      subType: "Travel",
      linkedTripId: form.linkedTripId || "", linkedTripLabel: linkedTarget ? tripLabel(linkedTarget) : "",
      pnr: form.pnr.trim(),
      fullName: tf.fullName.trim(), contactNumber: tf.contactNumber.trim(), email: tf.email.trim(),
      tripType: tf.tripType,
      departureCity: tf.departureCity.trim(), arrivalCity: tf.arrivalCity.trim(),
      departureDate: tf.departureDate, departureFlightTime: tf.departureFlightTime,
      returnDate: tf.tripType === "Round Trip" ? tf.returnDate : "", returnFlightTime: tf.tripType === "Round Trip" ? tf.returnFlightTime : "",
      reasons: tf.reasons, reasonOther: tf.reasons.includes("Other") ? tf.reasonOther.trim() : "",
      isEmergency: isShortNotice ? "Yes" : "No",
      emergencyReason: isShortNotice ? tf.emergencyReason.trim() : "",
      meetingsCount: Number(tf.meetingsCount) || tf.meetings.length,
      meetings: tf.meetings.map(m => ({ orgName: m.orgName.trim(), meetingWith: m.meetingWith.trim() })),
      peopleCount: Number(tf.peopleCount) || tf.travellers.length,
      travellers: tf.travellers.map(t => ({ name: t.name.trim(), age: Number(t.age), sex: t.sex })),
      desiredOutcomes: tf.desiredOutcomes.trim(),
      leadDays, urgent: isShortNotice,
      overshootJustification: isOvershoot ? form.overshootJustification.trim() : "",
      // mirrors so existing route/date rendering keeps working
      fromLocation: tf.departureCity.trim(), toLocation: tf.arrivalCity.trim(), startDate: tf.departureDate, endDate: tf.returnDate,
    });
    const travelDescription = !isTravelType ? "" : (isAccommodation ? `Accommodation: ${form.place.trim()}` : `Travel: ${tf.departureCity.trim()} → ${tf.arrivalCity.trim()}`);
    const travelPurpose = !isTravelType ? "" : (isAccommodation ? "Accommodation stay" : (travelReasonText || "Travel"));
    const newRequest = {
      id: "EXP-" + Date.now(), kind: "Payment", createdDate: now,
      requesterId: user.id, requesterName: user.name, requesterEmail: user.email, dept: user.dept,
      expenseTypeId: form.expenseTypeId, expenseTypeName: selectedType.name, category: selectedType.category,
      isProject, projectId: useSplit ? null : form.projectId, splits: splitData,
      vendor: form.vendor,
      description: isTravelType ? travelDescription : form.description,
      purpose: isTravelType ? travelPurpose : form.purpose,
      amount: useSplit ? splitTotalINR : parseFloat(form.amount), currency: useSplit ? "INR" : form.currency, fxRate: useSplit ? 1 : parseFloat(form.fxRate), amountINR,
      travel: travelObj,
      invoiceNumber: form.invoiceNumber, attachment: form.attachment,
      linkedPOId: useSplit ? null : (form.linkedPOId || null), linkedPONumber: useSplit ? null : (linkedPOInfo?.poNumber || null),
      selectedApprovers: selectedApproverIds,
      currentStage: initialStage, status: getStageLabel(initialStage),
      resubmittedFrom: resubmitFrom?.id || null,
      revisedFrom: resubmitFrom?.id || null,
      revisionNote: resubmitFrom ? (resubmitFrom.returnRemarks || (resubmitFrom.history || []).filter(h => (h.action || "").includes("Reject")).map(h => h.comments).pop() || "") : "",
      revisionRound: resubmitFrom ? (resubmitFrom.revisionRound || 0) + 1 : 0,
      history: [
        ...(resubmitFrom ? [{ action: "Resubmitted", by: user.name, byId: user.id, at: now, comments: `From ${resubmitFrom.id}` }] : []),
        { action: "Submitted", by: user.name, byId: user.id, at: now, comments: "Payment request raised" + (linkedPOInfo ? ` against PO ${linkedPOInfo.poNumber}` : "") }
      ],
    };
    await saveRequests([newRequest, ...requests]);
    setSubmitting(false);
    onSuccess();
  }

  // Preview only — resolve the real role-holder from the live roster (their name if
  // exactly one holds the role, else a generic role label). Actual routing is by role
  // via the workflow engine + server guard, not these labels.
  const roster = getRoster();
  const roleLabel = (role, fallback) => { const us = roster.filter(u => u.role === role); return us.length === 1 ? us[0].name : fallback; };
  const flowSteps = [user.name];
  if (needsMid) flowSteps.push(roleLabel("BoxBuildMidApprover", "Delivery Head"));
  else if (isOdmProject) flowSteps.push(eligibleApprovers.map(a => a.name).join(" + ") || "Dept Heads");
  else if (isMultiApprover && form.selectedApproverIds.length > 0) flowSteps.push(form.selectedApproverIds.map(id => roster.find(u => u.id === id)?.name).filter(Boolean).join(" + "));
  else if (eligibleApprovers.length === 1) flowSteps.push(eligibleApprovers[0].name);
  else if (isMultiApprover) flowSteps.push("<select approver>");
  else if (!soleHead) flowSteps.push("Dept Head");
  // Sole Finance Head raising their own request skips the Finance Head step too.
  if (!(soleHead && user.role === "FinanceHead")) flowSteps.push(roleLabel("FinanceHead", "Finance Head"));
  if (amountINR >= VP_THRESHOLD && amountINR < CEO_THRESHOLD) flowSteps.push(roleLabel("VP", "VP"));
  if (amountINR >= CEO_THRESHOLD) flowSteps.push(roleLabel("CEO", "CEO"));
  flowSteps.push(roleLabel("Accountant", "Accountant"));

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-3xl">
      {resubmitFrom && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
          <RotateCcw className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-semibold text-amber-900">Resubmitting from {resubmitFrom.id}</div>
            <div className="text-xs text-amber-800 mt-0.5">Edit and resubmit. Original rejected request stays in audit log.</div>
          </div>
        </div>
      )}
      <div className="flex items-center gap-2 mb-1">
        <Wallet className="w-5 h-5 text-blue-600" />
        <h2 className="text-xl font-bold text-slate-900">Raise Payment Request</h2>
      </div>
      <p className="text-sm text-slate-600 mb-5">For project expenses, both an approved Budget AND an approved PO are mandatory.</p>

      <div className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Department</label>
            <input value={user.dept} disabled className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-600" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Expense Type *</label>
            <select value={form.expenseTypeId} onChange={(e) => setForm({ ...form, expenseTypeId: e.target.value, selectedApproverIds: [], linkedPOId: "" })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="">Select type</option>
              {!NON_PROJECT_DEPTS.includes(user.dept) && (
                <optgroup label="Project Expenses (Budget + PO required)">
                  {EXPENSE_TYPES.filter(t => t.category === "Project").map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </optgroup>
              )}
              <optgroup label="Non-Project Expenses">
                {EXPENSE_TYPES.filter(t => t.category === "Non-Project" && !TRAVEL_EXPENSE_IDS.includes(t.id)).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </optgroup>
              <optgroup label="Travel & Accommodation">
                {EXPENSE_TYPES.filter(t => TRAVEL_EXPENSE_IDS.includes(t.id)).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </optgroup>
            </select>
            {NON_PROJECT_DEPTS.includes(user.dept) && <p className="text-xs text-slate-500 mt-1">{user.dept} cannot raise project expenses.</p>}
          </div>
        </div>

        {isProject && (
          <label className="flex items-center gap-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 cursor-pointer flex-wrap">
            <input type="checkbox" checked={splitMode} onChange={(e) => setSplitMode(e.target.checked)} className="w-4 h-4" />
            <span className="font-medium">Split this payment across multiple projects</span>
            <span className="text-xs text-slate-500">(one supplier · same department · each drawn against its own budget)</span>
          </label>
        )}

        {isProject && !splitMode && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Project (must have approved budget) *</label>
            {activeBudgets.length === 0 ? (
              <div className="px-3 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
                <AlertTriangle className="w-4 h-4 inline mr-1" />No active project budgets.
              </div>
            ) : (
              <select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value, linkedPOId: "" })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                <option value="">Select project</option>
                {activeBudgets.map(b => {
                  const avail = b.amountINR - getProjectSpend(requests, b.projectId).total;
                  const tag = b.projectType === "RD" ? "[R&D] " : b.projectType === "OneTime" ? "[One-Time] " : "[Client] ";
                  return <option key={b.projectId} value={b.projectId}>{tag}{b.projectId} — {b.projectName} (₹{(avail / 100000).toFixed(2)}L avail)</option>;
                })}
              </select>
            )}
          </div>
        )}

        {/* Split table — one supplier payment across multiple same-dept projects */}
        {useSplit && (
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 space-y-2">
            <div className="text-xs font-bold text-indigo-900">Project split — each row draws against its own project budget</div>
            {splitProjects.length === 0 && <div className="text-xs text-red-700"><AlertTriangle className="w-3.5 h-3.5 inline mr-1" />No active project budgets in {user.dept}.</div>}
            {splits.map((row, i) => {
              const rowPOs = row.projectId ? getApprovedPOsForProject(pos, row.projectId) : [];
              const availBudget = row.projectId ? projAvailable(row.projectId) : 0;
              const rowPO = row.linkedPOId ? pos.find(p => p.id === row.linkedPOId) : null;
              const availPO = rowPO ? getPOAvailable(rowPO, requests) : 0;
              const amt = parseFloat(row.amount) || 0;
              const over = !!row.projectId && (amt > availBudget || (!!rowPO && amt > availPO));
              return (
                <div key={i} className="bg-white rounded-lg border border-slate-200 p-2 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <select value={row.projectId} onChange={(e) => setSplitRow(i, { projectId: e.target.value, linkedPOId: "" })} className="flex-1 min-w-[160px] px-2 py-1.5 border border-slate-300 rounded text-sm bg-white">
                      <option value="">Select project</option>
                      {/* Hide projects already chosen in other rows — each project (and
                          thus its PO) can appear at most once, else it'd be one project. */}
                      {splitProjects.filter(b => b.projectId === row.projectId || !splits.some((o, idx) => idx !== i && o.projectId === b.projectId)).map(b => <option key={b.projectId} value={b.projectId}>{b.projectId} — {b.projectName}</option>)}
                    </select>
                    <input type="number" value={row.amount} onChange={(e) => setSplitRow(i, { amount: e.target.value })} placeholder="₹ amount" className={`w-32 px-2 py-1.5 border rounded text-sm ${over ? "border-red-400 bg-red-50" : "border-slate-300"}`} />
                    {splits.length > 2 && <button type="button" onClick={() => setSplits(splits.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-red-600 px-1">✕</button>}
                  </div>
                  {row.projectId && (rowPOs.length === 0 ? (
                    <div className="text-[11px] text-red-700"><AlertTriangle className="w-3 h-3 inline mr-0.5" />No approved PO for {row.projectId} — raise one first.</div>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      <select value={row.linkedPOId} onChange={(e) => setSplitRow(i, { linkedPOId: e.target.value })} className="flex-1 min-w-[160px] px-2 py-1.5 border border-fuchsia-300 rounded text-sm bg-white">
                        <option value="">Select approved PO</option>
                        {rowPOs.map(po => <option key={po.id} value={po.id}>{po.poNumber} — {po.supplierName} (₹{(getPOAvailable(po, requests) / 100000).toFixed(2)}L avail)</option>)}
                      </select>
                      <span className={`text-[11px] whitespace-nowrap ${over ? "text-red-600 font-semibold" : "text-slate-500"}`}>budget ₹{(availBudget / 100000).toFixed(2)}L{rowPO ? ` · PO ₹${(availPO / 100000).toFixed(2)}L` : ""}</span>
                    </div>
                  ))}
                </div>
              );
            })}
            <button type="button" onClick={() => setSplits([...splits, { projectId: "", amount: "", linkedPOId: "" }])} className="text-xs font-semibold text-indigo-700 hover:text-indigo-900">+ Add project</button>
            <div className="text-sm font-bold text-slate-900 pt-1 border-t border-indigo-200">Split total: ₹{(splitTotalINR / 100000).toFixed(2)}L</div>
          </div>
        )}

        {/* PO selection for project */}
        {isProject && !splitMode && form.projectId && (
          <div className={`rounded-lg p-3 border ${projectPOs.length === 0 ? "bg-red-50 border-red-200" : "bg-fuchsia-50 border-fuchsia-200"}`}>
            <label className="block text-xs font-bold text-fuchsia-900 mb-1.5">
              <FileSignature className="w-3.5 h-3.5 inline mr-1" />Linked PO * (mandatory for project payments)
            </label>
            {projectPOs.length === 0 ? (
              <div className="text-xs text-red-800">
                <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />No approved POs for this project. Raise a PO Request first.
              </div>
            ) : (
              <>
                <select value={form.linkedPOId} onChange={(e) => setForm({ ...form, linkedPOId: e.target.value })} className="w-full px-3 py-2 border border-fuchsia-300 rounded-lg text-sm bg-white">
                  <option value="">Select an approved PO</option>
                  {projectPOs.map(po => {
                    const avail = getPOAvailable(po, requests);
                    const editing = hasPendingEdit(po.id) ? " ⚠ edit pending" : "";
                    return <option key={po.id} value={po.id}>{po.poNumber} — {po.supplierName} (₹{(avail / 100000).toFixed(2)}L avail of ₹{(po.amountINR / 100000).toFixed(2)}L){editing}</option>;
                  })}
                </select>
                {linkedPO && (
                  <div className="mt-2 text-xs text-fuchsia-800 bg-white rounded p-2 border border-fuchsia-200">
                    <div className="font-semibold">{linkedPO.poNumber} · {linkedPO.supplierName}</div>
                    <div>Approved: ₹{(linkedPO.amountINR / 100000).toFixed(2)}L · Used: ₹{(poUsage.total / 100000).toFixed(2)}L · Available: <strong className="text-emerald-700">₹{(poAvailable / 100000).toFixed(2)}L</strong></div>
                    {linkedPOHasPendingEdit && (
                      <div className="mt-1.5 bg-amber-50 border border-amber-200 rounded p-1.5 text-amber-900">
                        <Edit3 className="w-3 h-3 inline mr-1" /><strong>Edit Pending:</strong> An edit request is in approval. PO amount may change once approved. Payment is still allowed against current amount.
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {!isProject && selectedType && deptPOs.length > 0 && (
          <div className="rounded-lg p-3 border bg-fuchsia-50 border-fuchsia-200">
            <label className="block text-xs font-bold text-fuchsia-900 mb-1.5">
              <FileSignature className="w-3.5 h-3.5 inline mr-1" />Link to PO (optional)
            </label>
            <select value={form.linkedPOId} onChange={(e) => setForm({ ...form, linkedPOId: e.target.value })} className="w-full px-3 py-2 border border-fuchsia-300 rounded-lg text-sm bg-white">
              <option value="">No PO (small payment via Monthly Budget pool)</option>
              {deptPOs.map(po => {
                const avail = getPOAvailable(po, requests);
                const editing = hasPendingEdit(po.id) ? " ⚠ edit pending" : "";
                return <option key={po.id} value={po.id}>{po.poNumber} — {po.supplierName} (₹{(avail / 100000).toFixed(2)}L avail){editing}</option>;
              })}
            </select>
            {linkedPO && (
              <div className="mt-2 text-xs text-fuchsia-800 bg-white rounded p-2 border border-fuchsia-200">
                <div className="font-semibold">{linkedPO.poNumber} · {linkedPO.supplierName}</div>
                <div>Approved: ₹{(linkedPO.amountINR / 100000).toFixed(2)}L · Available: <strong className="text-emerald-700">₹{(poAvailable / 100000).toFixed(2)}L</strong></div>
                <div className="mt-1 italic">Note: Will deduct from BOTH this PO and Monthly Budget pool.</div>
                {linkedPOHasPendingEdit && (
                  <div className="mt-1.5 bg-amber-50 border border-amber-200 rounded p-1.5 text-amber-900">
                    <Edit3 className="w-3 h-3 inline mr-1" /><strong>Edit Pending</strong> — amount may change.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!isProject && selectedType && (
          <>
            {!isTravelType && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Purpose *</label>
                <input value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="e.g. Quarterly team offsite" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
            )}
            {monthlyBudget ? (
              <div className={`rounded-lg p-3 border ${amountINR > monthlyAvailable ? "bg-red-50 border-red-200" : monthlyUsage.total / monthlyBudget.amountINR > 0.8 ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"}`}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Target className="w-4 h-4 text-slate-700" />
                  <div className="text-xs font-bold text-slate-900">📊 {user.dept} Monthly Pool — {poolName}</div>
                </div>
                <div className="text-xs text-slate-700 mb-1">Approved by <strong>{monthlyBudget.approvedBy || monthlyBudget.requesterName}</strong> · Available to all {user.dept} members</div>
                <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                  <div className="bg-white rounded p-1.5"><div className="text-slate-500">Approved</div><div className="font-bold">₹{(monthlyBudget.amountINR / 1000).toFixed(1)}K</div></div>
                  <div className="bg-white rounded p-1.5"><div className="text-slate-500">Used</div><div className="font-bold">₹{(monthlyUsage.total / 1000).toFixed(1)}K</div></div>
                  <div className="bg-white rounded p-1.5"><div className="text-slate-500">Available</div><div className="font-bold text-emerald-700">₹{(monthlyAvailable / 1000).toFixed(1)}K</div></div>
                </div>
                {amountINR > monthlyAvailable && (isTravelType ? (
                  <div className="mt-1">
                    <div className="text-xs text-red-700 font-semibold mb-1">⚠ Exceeds the available pool by ₹{((amountINR - monthlyAvailable) / 1000).toFixed(1)}K. Allowed with a justification:</div>
                    <textarea value={form.overshootJustification} onChange={(e) => setForm({ ...form, overshootJustification: e.target.value })} rows={2} placeholder="Why does this travel need to exceed the allocated budget?" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                  </div>
                ) : (
                  <div className="text-xs text-red-700 font-semibold">⚠ Exceeds available budget. Ask Dept Head for an Extension.</div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg p-3 bg-amber-50 border border-amber-200 text-xs">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-amber-900">No Monthly Budget Pool for this category</div>
                    <div className="text-amber-800 mt-0.5">{user.dept} doesn't have an active Monthly Budget for <strong>{poolName}</strong> in {currentMonth}. Ask your Dept Head to raise one.</div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {hasPendingOutcomes && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-3">
            <div className="flex items-center gap-1.5 text-sm font-bold text-red-800 mb-1"><AlertTriangle className="w-4 h-4" />Pending Travel Outcome Form{pendingOutcomes.length > 1 ? "s" : ""}</div>
            <div className="text-xs text-red-700 mb-2">You have {pendingOutcomes.length} completed trip{pendingOutcomes.length > 1 ? "s" : ""} without a Travel Outcome Form. File {pendingOutcomes.length > 1 ? "them" : "it"} under <strong>My Requests</strong> → open the trip below → click <strong>“Fill post-travel form”</strong>:</div>
            <ul className="text-xs text-red-800 list-disc ml-5 mb-2 space-y-0.5">
              {pendingOutcomes.map(o => <li key={o.id}>{o.description} · {o.createdDate ? new Date(o.createdDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : ""} · <span className="font-mono">{o.id}</span></li>)}
            </ul>
            <label className="flex items-start gap-2 text-xs text-red-900 cursor-pointer">
              <input type="checkbox" checked={ackPending} onChange={(e) => setAckPending(e.target.checked)} className="w-4 h-4 mt-0.5 shrink-0" />
              <span><strong>Disclaimer:</strong> I acknowledge I have pending Travel Outcome Form(s) and will submit them promptly. Repeatedly leaving trip outcomes unfiled may affect future travel approvals.</span>
            </label>
          </div>
        )}

        {isTravelType && (isAccommodation ? (
          <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-sky-900"><BedDouble className="w-4 h-4" />Accommodation details</div>
            <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">Location / Hotel *</label><input value={form.place} onChange={(e) => setForm({ ...form, place: e.target.value })} placeholder="Hotel name, city" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
            <div className="grid md:grid-cols-2 gap-4">
              <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">Check-in *</label><input type="date" min={todayISO} value={form.travelStart} onChange={(e) => setForm({ ...form, travelStart: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
              <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">Check-out *</label><input type="date" value={form.travelEnd} min={form.travelStart || todayISO} onChange={(e) => setForm({ ...form, travelEnd: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
            </div>
            <div className={`rounded-lg p-2.5 border text-xs ${accomOverCap ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"}`}>
              <div className="text-slate-800">Your accommodation cap: <strong>₹{accomCap.toLocaleString("en-IN")}/night</strong>{accomNights > 0 ? <> × {accomNights} night{accomNights > 1 ? "s" : ""} = <strong>₹{accomMax.toLocaleString("en-IN")}</strong> max</> : <> (set check-in/out to see the max)</>}</div>
              {accomOverCap && (
                <div className="mt-1">
                  <div className="text-red-700 font-semibold mb-1">⚠ Exceeds your cap by ₹{(amountINR - accomMax).toLocaleString("en-IN")}. Allowed with a justification:</div>
                  <textarea value={form.accomCapJustification} onChange={(e) => setForm({ ...form, accomCapJustification: e.target.value })} rows={2} placeholder="Why does this stay need to exceed your accommodation cap?" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
              )}
            </div>
            {isShortNotice && (
              <div className="rounded-lg p-2.5 border bg-amber-50 border-amber-200">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 mb-1"><Clock className="w-4 h-4" />Short notice — starts in {leadDays} day(s)</div>
                <textarea value={form.urgencyJustification} onChange={(e) => setForm({ ...form, urgencyJustification: e.target.value })} rows={2} placeholder={`Why is this needed under the ${TRAVEL_MIN_LEAD_DAYS}-day notice?`} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
            )}
          </div>
        ) : (
          <TravelFields tf={tf} setTf={setTf} leadDays={leadDays} isShortNotice={isShortNotice} />
        ))}

        {isTravelType && linkTargets.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Link to related {linkCounterpart.toLowerCase()} <span className="font-normal text-slate-400">(same trip · optional)</span></label>
            <select value={form.linkedTripId} onChange={(e) => setForm({ ...form, linkedTripId: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="">Not linked</option>
              {linkTargets.map(t => <option key={t.id} value={t.id}>{tripLabel(t)}</option>)}
            </select>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Vendor / Payee</label>
            <input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder="Vendor name" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
          {isVendorPayment && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Invoice Number</label>
              <input value={form.invoiceNumber} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })} placeholder="INV-2026-001" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
          )}
          {isTravelType && !isAccommodation && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Flight PNR <span className="font-normal text-slate-400">(if already booked)</span></label>
              <input value={form.pnr} onChange={(e) => setForm({ ...form, pnr: e.target.value })} placeholder="e.g. ABC123" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
          )}
        </div>

        {!isTravelType && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Description *</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What is this expense for?" rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
        )}

        {!useSplit && <CurrencyInput value={form.amount} currency={form.currency} fxRate={form.fxRate} onChange={(v) => setForm({ ...form, amount: v.amount, currency: v.currency, fxRate: v.fxRate })} label="Amount" required />}

        {isMultiApprover && !isOdmProject && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
            <label className="block text-xs font-semibold text-indigo-900 mb-2">Select Approver *</label>
            <div className="space-y-1.5">
              {eligibleApprovers.map(a => (
                <label key={a.id} className="flex items-center gap-2 cursor-pointer bg-white rounded px-3 py-2 border border-indigo-200 hover:bg-indigo-50">
                  <input type="radio" checked={form.selectedApproverIds.includes(a.id)} onChange={() => setForm({ ...form, selectedApproverIds: [a.id] })} className="w-4 h-4" />
                  <div><div className="text-sm font-semibold text-slate-900">{a.name}</div><div className="text-xs text-slate-500">{a.designation}</div></div>
                </label>
              ))}
            </div>
          </div>
        )}
        {isOdmProject && <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-xs font-semibold text-indigo-900">ODM Project requests need approval from BOTH Shreya and Akash.</div>}

        <AttachmentInput form={form} setForm={setForm} handleFileUpload={handleFileUpload} required />

        {amountINR > 0 && form.expenseTypeId && <FlowPreview steps={flowSteps} />}
        {err && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{err}</div>}
        <div className="flex gap-2">
          <button onClick={submit} disabled={submitting} className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-semibold px-5 py-2.5 rounded-lg text-sm">{submitting ? "Submitting…" : (resubmitFrom ? "Resubmit" : "Submit Payment Request")}</button>
        </div>
      </div>
    </div>
  );
}
