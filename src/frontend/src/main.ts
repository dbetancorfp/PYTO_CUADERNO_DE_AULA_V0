// Bootstrap entry point — one static index.html shared by every view (see CLAUDE.md's
// "Repository Structure"). Only the view matching the current path is ever created: its
// custom element is instantiated via `document.createElement`, wired to its real service,
// and appended to the DOM only afterward — never pre-placed as a static tag in index.html.
// This matters because a custom element already present in parsed HTML upgrades (and its
// `connectedCallback` fires) the instant its class is defined, which happens as soon as its
// module is imported — before this file would otherwise get a chance to set `.service`.
// `DashboardView` calls `this.service` eagerly in `connectedCallback` (to check the
// session), so that race left it permanently unrendered. `document.createElement` first,
// wire `.service`, append last — the same order every unit test already uses — avoids the
// race entirely, for every view, not just this one.
document.addEventListener('DOMContentLoaded', () => {
  void bootstrap();
});

async function bootstrap(): Promise<void> {
  if (window.location.pathname === '/dashboard') {
    const [{ HttpSessionApiService }, { DashboardView }] = await Promise.all([
      import('./http-session-api-service'),
      import('./dashboard-view'),
    ]);
    const dashboardView = document.createElement('app-dashboard-view') as InstanceType<typeof DashboardView>;
    dashboardView.service = new HttpSessionApiService();
    document.body.appendChild(dashboardView);
    return;
  }

  if (window.location.pathname === '/configuracion/profesor') {
    const [{ HttpSessionApiService }, { HttpTeacherSettingsApiService }, { TeacherSettingsView }] = await Promise.all([
      import('./http-session-api-service'),
      import('./http-teacher-settings-api-service'),
      import('./teacher-settings-view'),
    ]);
    const teacherSettingsView = document.createElement('app-teacher-settings-view') as InstanceType<
      typeof TeacherSettingsView
    >;
    teacherSettingsView.sessionService = new HttpSessionApiService();
    teacherSettingsView.settingsService = new HttpTeacherSettingsApiService();
    document.body.appendChild(teacherSettingsView);
    return;
  }

  if (window.location.pathname === '/configuracion/ciclos-modulos') {
    const [
      { HttpSessionApiService },
      { HttpCatalogTrainingCycleApiService },
      { HttpCatalogModuleApiService },
      { TrainingCatalogSettingsView },
    ] = await Promise.all([
      import('./http-session-api-service'),
      import('./http-catalog-training-cycle-api-service'),
      import('./http-catalog-module-api-service'),
      import('./training-catalog-settings-view'),
    ]);
    const trainingCatalogSettingsView = document.createElement('app-training-catalog-settings-view') as InstanceType<
      typeof TrainingCatalogSettingsView
    >;
    trainingCatalogSettingsView.sessionService = new HttpSessionApiService();
    trainingCatalogSettingsView.trainingCycleService = new HttpCatalogTrainingCycleApiService();
    trainingCatalogSettingsView.moduleService = new HttpCatalogModuleApiService();
    document.body.appendChild(trainingCatalogSettingsView);
    return;
  }

  if (window.location.pathname === '/configuracion/ano-academico') {
    // NOT WIRED (2026-08-04 redesign) — this screen's former tables (training_cycles,
    // modules, academic_years, academic_year_modules) were dropped and are not recreated in
    // this pass (see views/configuracion/functional-spec.json's "NOT WIRED" elementSpecs).
    // `LocalAcademicYearStore` backs all three services with a single, page-lifetime-scoped
    // in-memory instance — no fetch call, nothing persists across a reload. A future view
    // rebuilds this screen's real data layer.
    const [
      { HttpSessionApiService },
      { LocalAcademicYearStore },
      { LocalTrainingCycleApiService },
      { LocalModuleApiService },
      { LocalAcademicYearApiService },
      { AcademicYearSettingsView },
    ] = await Promise.all([
      import('./http-session-api-service'),
      import('./local-academic-year-store'),
      import('./local-training-cycle-api-service'),
      import('./local-module-api-service'),
      import('./local-academic-year-api-service'),
      import('./academic-year-settings-view'),
    ]);
    const academicYearSettingsView = document.createElement('app-academic-year-settings-view') as InstanceType<
      typeof AcademicYearSettingsView
    >;
    const store = new LocalAcademicYearStore();
    academicYearSettingsView.sessionService = new HttpSessionApiService();
    academicYearSettingsView.trainingCycleService = new LocalTrainingCycleApiService(store);
    academicYearSettingsView.moduleService = new LocalModuleApiService(store);
    academicYearSettingsView.academicYearService = new LocalAcademicYearApiService(store);
    document.body.appendChild(academicYearSettingsView);
    return;
  }

  const [{ HttpAuthApiService }, { LoginView }] = await Promise.all([
    import('./http-auth-api-service'),
    import('./login-view'),
  ]);
  const loginView = document.createElement('app-login-view') as InstanceType<typeof LoginView>;
  loginView.service = new HttpAuthApiService();
  document.body.appendChild(loginView);
}
