# FPAS UI — Open Questions

## 1. Live Examples Endpoint
**Question**: Do we want a temporary `/examples` endpoint in FPAS for live examples?

**Pros**:
- Always up-to-date with current API
- No manual sync needed
- Examples validate against live constraints

**Cons**:
- Adds backend work to FPAS
- Couples UI to backend for examples

**Recommendation**: Start with static examples in `lib/examples/`, revisit if drift becomes problematic

---

## 2. Default Patient IDs
**Question**: Preferred patient IDs and CDS service IDs for the default demo?

**Suggested**:
- `pat-001` (Approved scenario)
- `pat-002` (Pended scenario)
- `pat-003` (Denied scenario)
- `cds-pas-requirements` (CDS Hooks service ID)

**Decision Needed**: Confirm with FPAS backend team

---

## 3. Offline Mock Mode
**Question**: Should we support offline mode with mocked responses?

**Pros**:
- Works without network
- Good for sales demos
- No backend dependency

**Cons**:
- Maintenance burden
- Mock drift from real API
- Not testing actual integration

**Recommendation**: Phase 2 feature if requested; POC focuses on live API testing

---

## 4. Token Management
**Question**: Should mock tokens be configurable or hardcoded?

**Options**:
- A) Hardcoded per scope (simplest)
- B) User can paste custom token (flexible)
- C) No tokens, rely on CORS only (easiest)

**Recommendation**: Start with option A (hardcoded mock tokens), add option B if testers need real tokens

---

## 5. Analytics Tracking
**Question**: Should we track usage (page views, API calls) for product insights?

**Pros**:
- Understand which features are most valuable
- Identify pain points

**Cons**:
- Privacy concerns
- Extra complexity

**Recommendation**: Use Vercel Analytics (privacy-friendly, zero config) if desired

---

## Decision Log

| Question | Decision | Date | Who |
|----------|----------|------|-----|
| 1. Live examples endpoint | TBD | - | - |
| 2. Default patient IDs | TBD | - | - |
| 3. Offline mock mode | Phase 2 | - | - |
| 4. Token management | Hardcoded | - | - |
| 5. Analytics | TBD | - | - |