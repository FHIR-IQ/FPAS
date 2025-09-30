# FPAS UI — Risks & Mitigations

## High-Priority Risks

### CORS from fpas-phi.vercel.app
**Risk**: Browser blocks API calls due to CORS policy

**Mitigation**: Verify/adjust CORS allowlist on FPAS backend before starting UI development

**Pre-flight Test**:
```bash
curl -I -X OPTIONS https://fpas-phi.vercel.app/fhir/metadata \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST"
```

### Endpoint drift vs UI assumptions
**Risk**: API changes break UI expectations

**Mitigation**: Centralize base URLs in lib/fhirClient.ts and expose in UI for easy updates

### Mock tokens not matching backend auth
**Risk**: Token switcher doesn't align with actual FPAS auth requirements

**Mitigation**: Start permissive (no auth enforcement); document required scopes in UI tooltips

## Medium-Priority Risks

### Monaco Editor bundle size
**Risk**: Large JS bundle (500KB+) slows initial load

**Mitigation**: Lazy load Monaco component, code splitting per route

### Example staleness
**Risk**: Pre-built JSON examples drift from current API

**Mitigation**: Validate examples against live API weekly, version examples with API release

## Low-Priority Risks

### Browser compatibility
**Risk**: Advanced features break in older browsers

**Mitigation**: Target Chrome/Firefox/Safari latest versions only, add browser detection warning

### Mobile experience
**Risk**: JSON editing on phones is impractical

**Mitigation**: Desktop/tablet only (>= 768px), show "Use desktop" message on mobile

## Risk Matrix

| Risk | Impact | Probability | Status |
|------|--------|-------------|--------|
| CORS Issues | High | High | Pre-check required |
| Endpoint Drift | Medium | Medium | Centralized config |
| Auth Mismatch | Medium | Low | Documented |
| Bundle Size | Medium | Low | Lazy loading |
| Example Staleness | Low | Medium | Monitored |
| Browser Compat | Low | Low | Tested |
| Mobile UX | Low | High | Accepted |