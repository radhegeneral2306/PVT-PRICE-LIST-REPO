import { useEffect, useState } from 'react';
import { useData } from '../../store/DataContext';
import {
  Badge, Button, ConfirmDialog, Icon, Input, ListGroup, ListRow, PageContainer, SectionTitle, Segmented, Sheet, TopBar, Toggle,
  getTheme, setTheme, timeAgo, useToast, type Theme,
} from '../../ui';
import { useInstall } from './install';
import type { Role, Settings, User } from '../../types';

const STALE_MIN = 1;
const STALE_MAX = 12;

interface UserForm { id?: string; name: string; role: Role; pin: string }

export function SettingsPage() {
  const data = useData();
  const { session, settings, syncStatus, lastSync, pendingWrites, refresh } = data;
  const toast = useToast();
  const isOwner = session?.user.role === 'owner';

  // Optimistic copy of settings while a save is in flight.
  const [local, setLocal] = useState<Settings | null>(null);
  const shown = local ?? settings;
  const [theme, setThemeState] = useState<Theme>(getTheme);
  const [confirmOut, setConfirmOut] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const { mode, install } = useInstall();
  const [iosHelp, setIosHelp] = useState(false);

  const [users, setUsers] = useState<User[] | null>(null);
  const [usersError, setUsersError] = useState(false);
  const [form, setForm] = useState<UserForm | null>(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const loadUsers = async () => {
    try { setUsers(await data.listUsers()); setUsersError(false); } catch { setUsersError(true); }
  };
  useEffect(() => { if (isOwner) void loadUsers(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [isOwner]);

  const saveSetting = async (patch: Partial<Settings>) => {
    const next = { ...shown, ...patch };
    setLocal(next);
    try {
      await data.saveSettings(next);
      toast.success('Saved');
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : 'Could not save. Try again.');
    } finally {
      setLocal(null);
    }
  };

  const syncText = (() => {
    const pend = pendingWrites > 0 ? ` · ${pendingWrites} ${pendingWrites === 1 ? 'change' : 'changes'} waiting` : '';
    const ago = lastSync ? timeAgo(lastSync) : '';
    if (syncStatus === 'syncing' || syncing) return 'Syncing now' + pend;
    if (syncStatus === 'offline') return (lastSync ? `Offline. Last synced ${ago}` : 'Offline') + pend;
    if (syncStatus === 'error') return 'Could not sync' + pend;
    return (lastSync ? `Synced ${ago}` : 'Not synced yet') + pend;
  })();
  const syncOk = syncStatus === 'idle' && pendingWrites === 0;

  const onSync = async () => {
    setSyncing(true);
    try { await refresh(); } finally { setSyncing(false); }
  };

  const openForm = (u?: User) => {
    setFormError('');
    setForm(u ? { id: u.id, name: u.name, role: u.role, pin: '' } : { name: '', role: 'staff', pin: '' });
  };

  const submitForm = async () => {
    if (!form) return;
    const name = form.name.trim();
    const pin = form.pin.trim();
    if (!name) return setFormError('Enter a name.');
    if (!form.id && !pin) return setFormError('Set a PIN of 4 to 8 digits.');
    if (pin && !/^\d{4,8}$/.test(pin)) return setFormError('PIN must be 4 to 8 digits.');
    setSaving(true);
    try {
      await data.saveUser({ id: form.id, name, role: form.role, ...(pin ? { pin } : {}) });
      toast.success(form.id ? 'User updated' : 'User added');
      setForm(null);
      await loadUsers();
    } catch (e) {
      setFormError(e instanceof Error && e.message ? e.message : 'Could not save this user.');
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    if (!form?.id) return;
    setSaving(true);
    try {
      await data.deleteUser(form.id);
      toast.success('User deleted');
      setConfirmDel(false);
      setForm(null);
      await loadUsers();
    } catch (e) {
      setConfirmDel(false);
      setFormError(e instanceof Error && e.message ? e.message : 'Could not delete this user.');
    } finally {
      setSaving(false);
    }
  };

  const me = session?.user;

  return (
    <>
      <TopBar title="Settings" />
      <PageContainer narrow>
        <div className="page" style={{ paddingTop: 0 }}>
          <SectionTitle>Account</SectionTitle>
          <ListGroup>
            <ListRow avatar={me?.name ?? '?'} title={me?.name ?? ''} trailing={<Badge tone={isOwner ? 'ok' : 'neutral'} icon={isOwner ? 'crown-simple' : undefined}>{isOwner ? 'Owner' : 'Staff'}</Badge>} />
          </ListGroup>

          {isOwner ? (
            <>
              <SectionTitle action={<Badge icon="lock-simple">Owner only</Badge>}>Users</SectionTitle>
              <ListGroup>
                {users === null && !usersError ? (
                  <div className="row" role="status" aria-label="Loading users"><span className="skeleton" style={{ width: 40, height: 40, borderRadius: 12 }} /><span className="skeleton" style={{ width: '45%', height: 14 }} /></div>
                ) : null}
                {usersError ? <ListRow title="Could not load users" subtitle="Tap to try again" onClick={() => void loadUsers()} chevron={false} /> : null}
                {(users ?? []).map((u) => (
                  <ListRow
                    key={u.id}
                    avatar={u.name}
                    title={u.name}
                    subtitle={u.role === 'owner' ? 'Sees all rates' : shown.hideRatesFromStaff ? 'Rates hidden' : 'Sees rates'}
                    trailing={<Badge tone={u.role === 'owner' ? 'ok' : 'neutral'}>{u.role === 'owner' ? 'Owner' : 'Staff'}</Badge>}
                    onClick={() => openForm(u)}
                    chevron={false}
                  />
                ))}
                <ListRow
                  leading={<span style={{ width: 40, display: 'grid', placeItems: 'center', color: 'var(--accent)', fontSize: 22 }}><Icon name="plus" weight="bold" /></span>}
                  title="Add user"
                  tone="accent"
                  onClick={() => openForm()}
                  chevron={false}
                />
              </ListGroup>

              <SectionTitle>Visibility</SectionTitle>
              <ListGroup>
                <div className="row">
                  <div className="grow t" style={{ fontWeight: 500 }} id="lbl-hide">Hide rates from staff</div>
                  <Toggle label="Hide rates from staff" checked={shown.hideRatesFromStaff} onChange={(v) => void saveSetting({ hideRatesFromStaff: v })} />
                </div>
                <div className="row">
                  <div className="grow">
                    <div className="t" style={{ fontWeight: 500 }}>Stale warning</div>
                    <div className="s" aria-live="polite">After {shown.staleWeeks} {shown.staleWeeks === 1 ? 'week' : 'weeks'}</div>
                  </div>
                  <div className="row-flex" style={{ gap: 6 }}>
                    <button type="button" className="iconbtn" aria-label="Fewer weeks" disabled={shown.staleWeeks <= STALE_MIN} onClick={() => void saveSetting({ staleWeeks: Math.max(STALE_MIN, shown.staleWeeks - 1) })}><Icon name="minus" weight="bold" /></button>
                    <span className="mono" style={{ minWidth: 28, textAlign: 'center', fontWeight: 600 }}>{shown.staleWeeks}</span>
                    <button type="button" className="iconbtn" aria-label="More weeks" disabled={shown.staleWeeks >= STALE_MAX} onClick={() => void saveSetting({ staleWeeks: Math.min(STALE_MAX, shown.staleWeeks + 1) })}><Icon name="plus" weight="bold" /></button>
                  </div>
                </div>
              </ListGroup>
            </>
          ) : null}

          <SectionTitle>Sync</SectionTitle>
          <ListGroup>
            <div className="row">
              <span style={{ color: syncOk ? 'var(--accent)' : 'var(--text-3)', fontSize: 28, display: 'grid' }}>
                <Icon name={syncOk ? 'cloud-check' : syncStatus === 'offline' ? 'cloud-slash' : syncStatus === 'error' ? 'warning' : 'cloud-arrow-up'} />
              </span>
              <div className="grow">
                <div className="t" role="status">{syncText}</div>
                <div className="s">Works offline</div>
              </div>
              <Button small icon="arrows-clockwise" loading={syncing || syncStatus === 'syncing'} onClick={() => void onSync()}>Sync now</Button>
            </div>
          </ListGroup>

          <SectionTitle>Appearance</SectionTitle>
          <div className="list" style={{ padding: 6 }}>
            <Segmented<Theme>
              label="Theme"
              value={theme}
              onChange={(v) => { setTheme(v); setThemeState(v); }}
              options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'system', label: 'System' }]}
            />
          </div>

          <div style={{ height: 20 }} />
          <ListGroup>
            {mode !== 'none' ? (
              <ListRow
                leading={<span style={{ width: 40, display: 'grid', placeItems: 'center', color: 'var(--text-2)', fontSize: 22 }}><Icon name="download-simple" /></span>}
                title="Install app on this phone"
                onClick={() => (mode === 'prompt' ? void install() : setIosHelp(true))}
              />
            ) : null}
            <ListRow
              leading={<span style={{ width: 40, display: 'grid', placeItems: 'center', color: 'var(--danger)', fontSize: 22 }}><Icon name="sign-out" /></span>}
              title="Sign out"
              tone="danger"
              onClick={() => setConfirmOut(true)}
              chevron={false}
            />
          </ListGroup>
        </div>
      </PageContainer>

      <Sheet
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? 'Edit user' : 'Add user'}
        footer={
          <>
            {form?.id && form.id !== me?.id ? <Button variant="danger" icon="trash" onClick={() => setConfirmDel(true)} disabled={saving}>Delete</Button> : null}
            <Button variant="primary" loading={saving} onClick={() => void submitForm()}>Save</Button>
          </>
        }
      >
        {form ? (
          <form className="stack" onSubmit={(e) => { e.preventDefault(); void submitForm(); }}>
            <Input label="Name" value={form.name} autoComplete="off" onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <div className="field">
              <label id="role-lbl">Role</label>
              <Segmented<Role> label="Role" value={form.role} onChange={(v) => setForm({ ...form, role: v })} options={[{ value: 'staff', label: 'Staff' }, { value: 'owner', label: 'Owner' }]} />
            </div>
            <Input
              label="PIN"
              value={form.pin}
              inputMode="numeric"
              autoComplete="off"
              maxLength={8}
              placeholder={form.id ? '' : '4 to 8 digits'}
              helper={form.id ? 'Leave blank to keep the current PIN' : '4 to 8 digits'}
              onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })}
            />
            {formError ? <div className="error-text" role="alert">{formError}</div> : null}
            <button type="submit" hidden />
          </form>
        ) : null}
      </Sheet>

      <ConfirmDialog
        open={confirmDel}
        danger
        title={`Delete ${form?.name ?? 'user'}?`}
        message="They will no longer be able to sign in."
        confirmLabel="Delete"
        loading={saving}
        onConfirm={() => void doDelete()}
        onCancel={() => setConfirmDel(false)}
      />

      <ConfirmDialog
        open={confirmOut}
        title="Sign out?"
        message="Saved pricelists stay on this phone. You will need your PIN to sign in again."
        confirmLabel="Sign out"
        danger
        onConfirm={() => { setConfirmOut(false); data.logout(); }}
        onCancel={() => setConfirmOut(false)}
      />

      <Sheet open={iosHelp} onClose={() => setIosHelp(false)} title="Install on iPhone" footer={<Button variant="primary" onClick={() => setIosHelp(false)}>Got it</Button>}>
        <ol className="stack" style={{ paddingLeft: 20, margin: 0 }}>
          <li>Tap the <b>Share</b> button <Icon name="export" /> at the bottom of Safari.</li>
          <li>Scroll down and tap <b>Add to Home Screen</b>.</li>
          <li>Tap <b>Add</b>. The app now opens from your home screen.</li>
        </ol>
      </Sheet>
    </>
  );
}

