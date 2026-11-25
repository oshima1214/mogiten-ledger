import { useState } from 'react';
import type { GroupInfo } from '../domain/types';
import { validateGroupDraft } from '../domain/validate';
import type { GroupErrors } from '../domain/validate';
import { ScreenHeader, TextField } from './common';

export function GroupScreen(props: { group: GroupInfo | null; onSave(group: GroupInfo): void; onBack(): void }) {
  const [groupName, setGroupName] = useState(props.group?.groupName ?? '');
  const [representative, setRepresentative] = useState(props.group?.representative ?? '');
  const [errors, setErrors] = useState<GroupErrors>({});

  const save = () => {
    const e = validateGroupDraft({ groupName, representative });
    setErrors(e);
    if (Object.keys(e).length === 0) props.onSave({ groupName: groupName.trim(), representative: representative.trim() });
  };

  return (
    <div className="screen">
      <ScreenHeader title="グループ情報" onBack={props.onBack} backLabel="ホーム" />
      <main className="screen-body">
        <TextField label="グループ名" value={groupName} onChange={setGroupName} error={errors.groupName} />
        <TextField label="代表者名" value={representative} onChange={setRepresentative} error={errors.representative} />
      </main>
      <footer className="screen-footer">
        <button type="button" className="primary" onClick={save}>
          保存する
        </button>
      </footer>
    </div>
  );
}
