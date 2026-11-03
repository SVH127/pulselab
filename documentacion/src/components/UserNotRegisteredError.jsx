export default function UserNotRegisteredError() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md rounded-lg border border-border bg-card p-6 text-center">
        <h1 className="text-xl font-semibold">Usuario no registrado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tu cuenta de Google no tiene acceso a esta app.
        </p>
      </div>
    </div>
  );
}
