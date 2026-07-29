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

  if (window.location.pathname === '/configuracion/ano-academico') {
    const [
      { HttpSessionApiService },
      { HttpTrainingCycleApiService },
      { HttpModuleApiService },
      { HttpAcademicYearApiService },
      { AcademicYearSettingsView },
    ] = await Promise.all([
      import('./http-session-api-service'),
      import('./http-training-cycle-api-service'),
      import('./http-module-api-service'),
      import('./http-academic-year-api-service'),
      import('./academic-year-settings-view'),
    ]);
    const academicYearSettingsView = document.createElement('app-academic-year-settings-view') as InstanceType<
      typeof AcademicYearSettingsView
    >;
    academicYearSettingsView.sessionService = new HttpSessionApiService();
    academicYearSettingsView.trainingCycleService = new HttpTrainingCycleApiService();
    academicYearSettingsView.moduleService = new HttpModuleApiService();
    academicYearSettingsView.academicYearService = new HttpAcademicYearApiService();
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
