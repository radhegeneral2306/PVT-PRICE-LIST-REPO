import { useState } from 'react';
import { useData } from '../../store/DataContext';
import type { Category, Factory } from '../../types';
import { Button, Chip, Chips, Field, Input, Sheet, TextArea, useToast } from '../../ui';

const CATS: Category[] = ['Tiles', 'Sanitaryware', 'Other'];

export interface FactoryFormSheetProps {
  open: boolean;
  onClose: () => void;
  /** Pass a factory to edit it; omit to add a new one. */
  factory?: Factory;
  onSaved?: (f: Factory) => void;
}

/** Add / edit factory sheet. Used by the Factories list and the factory detail overflow menu. */
export function FactoryFormSheet(props: FactoryFormSheetProps) {
  return props.open ? <FormInner {...props} /> : null;
}

function FormInner({ onClose, factory, onSaved }: FactoryFormSheetProps) {
  const { saveFactory } = useData();
  const toast = useToast();
  const [name, setName] = useState(factory?.name ?? '');
  const [city, setCity] = useState(factory?.city ?? '');
  const [category, setCategory] = useState<Category>(factory?.category ?? 'Tiles');
  const [contactName, setContactName] = useState(factory?.contactName ?? '');
  const [phone, setPhone] = useState(factory?.phone ?? '');
  const [notes, setNotes] = useState(factory?.notes ?? '');
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState('');

  const nameErr = !name.trim() ? 'Enter the factory name' : '';
  const phoneErr = phone.trim() && !/^[\d\s]+$/.test(phone) ? 'Use digits only, for example 98250 11234' : '';

  async function submit() {
    setTried(true);
    setFailed('');
    if (nameErr || phoneErr) return;
    setSaving(true);
    try {
      const saved = await saveFactory(
        { name: name.trim(), city: city.trim(), category, contactName: contactName.trim(), phone: phone.trim(), notes: notes.trim() },
        factory?.id,
      );
      toast.success(factory ? 'Factory updated' : 'Factory added');
      onSaved?.(saved);
      onClose();
    } catch (e) {
      setFailed(e instanceof Error && e.message ? e.message : 'Could not save. Try again.');
      setSaving(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={factory ? 'Edit factory' : 'Add factory'}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" loading={saving} onClick={() => void submit()}>Save</Button>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); void submit(); }} noValidate>
        <Input label="Factory name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sunrise Ceramics" autoComplete="off" error={tried ? nameErr : ''} />
        <Input label="City" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Morbi" autoComplete="off" />
        <Field label="Category">
          <Chips label="Category">
            {CATS.map((c) => <Chip key={c} selected={category === c} onClick={() => setCategory(c)}>{c}</Chip>)}
          </Chips>
        </Field>
        <Input label="Contact person (optional)" value={contactName} onChange={(e) => setContactName(e.target.value)} autoComplete="off" />
        <Input label="Phone (optional)" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98250 11234" autoComplete="off" error={tried ? phoneErr : ''} />
        <TextArea label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Delivery days, payment terms" />
        {failed ? <div className="error-text" role="alert">{failed}</div> : null}
        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true" />
      </form>
    </Sheet>
  );
}
