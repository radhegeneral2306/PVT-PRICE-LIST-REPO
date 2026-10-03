import { useEffect, useState } from 'react';
import { useData } from '../../store/DataContext';
import { Button, Chip, Chips, Field, Input, Sheet } from '../../ui';
import type { Category, Factory } from '../../types';
import { CATEGORIES } from './state';

export function NewFactorySheet({ open, onClose, onCreated, initialName = '' }: {
  open: boolean;
  onClose: () => void;
  onCreated: (f: Factory) => void;
  initialName?: string;
}) {
  const { saveFactory } = useData();
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [category, setCategory] = useState<Category>('Tiles');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [nameError, setNameError] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(initialName); setCity(''); setCategory('Tiles'); setContactName(''); setPhone('');
    setBusy(false); setError(''); setNameError('');
  }, [open, initialName]);

  const submit = async () => {
    if (!name.trim()) { setNameError('Please enter the factory name.'); return; }
    setBusy(true); setError('');
    try {
      const f = await saveFactory({ name: name.trim(), city: city.trim(), category, contactName: contactName.trim(), phone: phone.trim(), notes: '' });
      onCreated(f);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the factory. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="New factory"
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" loading={busy} onClick={() => void submit()}>Add factory</Button>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <Input label="Factory name" value={name} onChange={(e) => { setName(e.target.value); setNameError(''); }} error={nameError} autoComplete="off" placeholder="e.g. Sunrise Ceramics" />
        <Input label="City" value={city} onChange={(e) => setCity(e.target.value)} autoComplete="off" placeholder="e.g. Morbi" />
        <Field label="Category">
          <Chips label="Category">
            {CATEGORIES.map((c) => <Chip key={c} selected={category === c} onClick={() => setCategory(c)}>{c}</Chip>)}
          </Chips>
        </Field>
        <Input label="Contact person (optional)" value={contactName} onChange={(e) => setContactName(e.target.value)} autoComplete="off" />
        <Input label="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="off" />
        {error ? <div className="error-text" role="alert">{error}</div> : null}
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}
