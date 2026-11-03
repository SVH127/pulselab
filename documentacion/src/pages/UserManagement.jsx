import { useState, useEffect } from 'react';
import { dataClient } from '@/api/dataClient';
import { PlusCircle, Edit2, Trash2, UserX, UserCheck, Check, GraduationCap, BookOpen, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function UserManagement() {
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showStudentModal, setShowStudentModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [studentForm, setStudentForm] = useState({ full_name: '', email: '' });
  const [savingStudent, setSavingStudent] = useState(false);
  const [invitedStudent, setInvitedStudent] = useState(false);

  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [teacherForm, setTeacherForm] = useState({ full_name: '', email: '' });
  const [savingTeacher, setSavingTeacher] = useState(false);
  const [invitedTeacher, setInvitedTeacher] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const [users, pendingUsers, accounts] = await Promise.all([
      dataClient.entities.User.list('-created_date'),
      dataClient.entities.PendingUser.list('-created_date'),
      dataClient.entities.StudentAccount.list('-created_date'),
    ]);
    const allUsersByEmail = new Map();
    [...pendingUsers, ...users].forEach((u) => allUsersByEmail.set(u.email, u));
    const allUsers = Array.from(allUsersByEmail.values());
    const studentUsers = allUsers.filter(u => u.role === 'user' || u.role === 'student' || !u.role);
    const teacherUsers = allUsers.filter(u => u.role === 'admin');

    const accountEmails = new Set(accounts.map(a => a.email));
    for (const u of studentUsers) {
      if (!accountEmails.has(u.email)) {
        await dataClient.entities.StudentAccount.create({
          full_name: u.full_name || u.email,
          email: u.email,
          is_active: u.is_active !== false,
          role: 'student',
        });
      }
    }
    const updated = await dataClient.entities.StudentAccount.list('-created_date');
    setStudents(updated);
    setTeachers(teacherUsers);
    setLoading(false);
  };

  const openCreateStudent = () => {
    setEditingStudent(null);
    setStudentForm({ full_name: '', email: '' });
    setInvitedStudent(false);
    setShowStudentModal(true);
  };

  const openEditStudent = (s) => {
    setEditingStudent(s);
    setStudentForm({ full_name: s.full_name, email: s.email });
    setInvitedStudent(false);
    setShowStudentModal(true);
  };

  const handleSaveStudent = async () => {
    if (!studentForm.full_name.trim() || !studentForm.email.trim()) return;
    setSavingStudent(true);
    if (editingStudent) {
      await dataClient.entities.StudentAccount.update(editingStudent.id, { full_name: studentForm.full_name });
      const existingUsers = await dataClient.entities.User.filter({ email: editingStudent.email });
      if (existingUsers[0]) await dataClient.entities.User.update(existingUsers[0].id, { full_name: studentForm.full_name });
      await dataClient.entities.PendingUser.update(editingStudent.email, { full_name: studentForm.full_name }).catch(() => null);
      setShowStudentModal(false);
    } else {
      await dataClient.users.inviteUser(studentForm.email, 'student', { full_name: studentForm.full_name });
      await dataClient.entities.StudentAccount.create({
        full_name: studentForm.full_name,
        email: studentForm.email,
        is_active: true,
        role: 'student',
      });
      setInvitedStudent(true);
    }
    setSavingStudent(false);
    load();
  };

  const handleToggleActive = async (s) => {
    await dataClient.entities.StudentAccount.update(s.id, { is_active: !s.is_active });
    const existingUsers = await dataClient.entities.User.filter({ email: s.email });
    if (existingUsers[0]) await dataClient.entities.User.update(existingUsers[0].id, { is_active: !s.is_active });
    await dataClient.entities.PendingUser.update(s.email, { is_active: !s.is_active }).catch(() => null);
    load();
  };

  const deleteUserRecordsByEmail = async (email) => {
    const normalizedEmail = email.trim().toLowerCase();
    const [users, accounts] = await Promise.all([
      dataClient.entities.User.filter({ email: normalizedEmail }),
      dataClient.entities.StudentAccount.filter({ email: normalizedEmail }),
    ]);

    await Promise.all([
      ...users.map((u) => dataClient.entities.User.delete(u.id)),
      ...accounts.map((a) => dataClient.entities.StudentAccount.delete(a.id)),
      dataClient.entities.PendingUser.delete(normalizedEmail).catch(() => null),
    ]);
  };

  const handleDeleteStudent = async (s) => {
    if (!confirm(`¿Eliminar definitivamente al estudiante "${s.full_name || s.email}"?`)) return;
    await deleteUserRecordsByEmail(s.email);
    load();
  };

  const openCreateTeacher = () => {
    setTeacherForm({ full_name: '', email: '' });
    setInvitedTeacher(false);
    setShowTeacherModal(true);
  };

  const handleSaveTeacher = async () => {
    if (!teacherForm.full_name.trim() || !teacherForm.email.trim()) return;
    setSavingTeacher(true);
    await dataClient.users.inviteUser(teacherForm.email, 'admin', { full_name: teacherForm.full_name });
    setInvitedTeacher(true);
    setSavingTeacher(false);
    load();
  };

  const handleDeleteTeacher = async (t) => {
    if (!confirm(`¿Eliminar definitivamente al docente/admin "${t.full_name || t.email}"?`)) return;
    await deleteUserRecordsByEmail(t.email);
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gestión de Usuarios</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Administra estudiantes y docentes de la plataforma.</p>
      </div>

      <Tabs defaultValue="students">
        <TabsList className="bg-secondary/40 border border-border">
          <TabsTrigger value="students" className="gap-2">
            <GraduationCap className="w-4 h-4" />Estudiantes
            <span className="ml-1 text-xs text-muted-foreground">({students.length})</span>
          </TabsTrigger>
          <TabsTrigger value="teachers" className="gap-2">
            <BookOpen className="w-4 h-4" />Docentes
            <span className="ml-1 text-xs text-muted-foreground">({teachers.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="students" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button onClick={openCreateStudent} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
              <PlusCircle className="w-4 h-4" />Nuevo Estudiante
            </Button>
          </div>
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/40">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nombre</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Correo</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Estado</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array(4).fill(0).map((_, i) => (
                      <tr key={i} className="border-b border-border/50">
                        {Array(4).fill(0).map((_, j) => (
                          <td key={j} className="px-4 py-3"><div className="h-4 bg-secondary/60 rounded animate-pulse" /></td>
                        ))}
                      </tr>
                    ))
                  ) : students.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">No hay estudiantes registrados.</td></tr>
                  ) : (
                    students.map(s => (
                      <tr key={s.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                        <td className="px-4 py-3 font-medium">{s.full_name}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs font-mono">{s.email}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-mono border ${s.is_active !== false ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                            {s.is_active !== false ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEditStudent(s)}><Edit2 className="w-4 h-4 text-muted-foreground" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleToggleActive(s)}>
                              {s.is_active !== false ? <UserX className="w-4 h-4 text-red-400" /> : <UserCheck className="w-4 h-4 text-green-400" />}
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteStudent(s)}>
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="teachers" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button onClick={openCreateTeacher} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
              <PlusCircle className="w-4 h-4" />Nuevo Docente/Admin
            </Button>
          </div>
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/40">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nombre</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Correo</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rol</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array(2).fill(0).map((_, i) => (
                      <tr key={i} className="border-b border-border/50">
                        {Array(3).fill(0).map((_, j) => (
                          <td key={j} className="px-4 py-3"><div className="h-4 bg-secondary/60 rounded animate-pulse" /></td>
                        ))}
                      </tr>
                    ))
                  ) : teachers.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">No hay docentes registrados.</td></tr>
                  ) : (
                    teachers.map(t => (
                      <tr key={t.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                        <td className="px-4 py-3 font-medium">{t.full_name || '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs font-mono">{t.email}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-xs px-2 py-0.5 rounded-full font-mono border bg-primary/10 text-primary border-primary/20">
                            Docente
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteTeacher(t)}>
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={showStudentModal} onOpenChange={v => { if (!v) { setShowStudentModal(false); setInvitedStudent(false); } }}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle>{editingStudent ? 'Editar Estudiante' : 'Nuevo Estudiante'}</DialogTitle>
          </DialogHeader>
          {invitedStudent ? (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Check className="w-4 h-4 text-green-400" />
                  <p className="text-sm font-semibold text-green-400">Usuario registrado</p>
                </div>
                <p className="text-sm text-muted-foreground"><span className="text-foreground font-medium">{studentForm.email}</span> ya puede entrar con Google.</p>
              </div>
              <Button onClick={() => { setShowStudentModal(false); setInvitedStudent(false); }} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">Cerrar</Button>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Nombre Completo</Label>
                <Input value={studentForm.full_name} onChange={e => setStudentForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Nombre Apellido" className="bg-input" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Correo electrónico</Label>
                <Input value={studentForm.email} onChange={e => setStudentForm(f => ({ ...f, email: e.target.value }))} placeholder="correo@ejemplo.com" type="email" className="bg-input" disabled={!!editingStudent} />
              </div>
              {!editingStudent && (
                <div className="rounded-lg bg-secondary/40 border border-border p-3 flex gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">No se envía correo en modo local. Se guarda el email permitido y el estudiante entra con Google.</p>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowStudentModal(false)} className="flex-1">Cancelar</Button>
                <Button onClick={handleSaveStudent} disabled={savingStudent || !studentForm.full_name.trim() || !studentForm.email.trim()} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground">
                  {savingStudent ? 'Guardando...' : editingStudent ? 'Guardar Cambios' : 'Registrar'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showTeacherModal} onOpenChange={v => { if (!v) { setShowTeacherModal(false); setInvitedTeacher(false); } }}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo Docente/Admin</DialogTitle>
          </DialogHeader>
          {invitedTeacher ? (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Check className="w-4 h-4 text-green-400" />
                  <p className="text-sm font-semibold text-green-400">Docente registrado</p>
                </div>
                <p className="text-sm text-muted-foreground"><span className="text-foreground font-medium">{teacherForm.email}</span> tendrá rol de docente/admin al entrar con Google.</p>
              </div>
              <Button onClick={() => { setShowTeacherModal(false); setInvitedTeacher(false); }} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">Cerrar</Button>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Nombre Completo</Label>
                <Input value={teacherForm.full_name} onChange={e => setTeacherForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Nombre Apellido" className="bg-input" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Correo electrónico</Label>
                <Input value={teacherForm.email} onChange={e => setTeacherForm(f => ({ ...f, email: e.target.value }))} placeholder="correo@ejemplo.com" type="email" className="bg-input" />
              </div>
              <div className="rounded-lg bg-secondary/40 border border-border p-3 flex gap-2">
                <Mail className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">No se envía correo. El docente entra con Google usando este email y tendrá permisos de admin.</p>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowTeacherModal(false)} className="flex-1">Cancelar</Button>
                <Button onClick={handleSaveTeacher} disabled={savingTeacher || !teacherForm.full_name.trim() || !teacherForm.email.trim()} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground">
                  {savingTeacher ? 'Guardando...' : 'Registrar'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
