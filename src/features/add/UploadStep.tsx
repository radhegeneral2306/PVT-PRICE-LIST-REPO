import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Icon, IconButton } from '../../ui';
import { useAdd } from './AddContext';
import { Frame } from './Frame';

function size(n: number): string {
  return n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

export function UploadStep() {
  const { state, dispatch, addFiles, retryFile, previewUrl } = useAdd();
  const navigate = useNavigate();
  const pick = useRef<HTMLInputElement>(null);
  const cam = useRef<HTMLInputElement>(null);
  const isPdf = state.method === 'pdf';
  const files = state.files;
  const busy = files.some((f) => f.status === 'uploading');
  const failed = files.some((f) => f.status === 'error');
  const done = files.filter((f) => f.status === 'done').length;

  const onPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (list.length) addFiles(list);
  };

  return (
    <Frame
      step={2}
      label={isPdf ? 'Upload PDF' : 'Add photos'}
      heading={isPdf ? 'Choose the PDF' : 'Add photos of the list'}
      backTo="/add/method"
      actions={
        <>
          <Button onClick={() => navigate(-1)}>Back</Button>
          <Button variant="primary" style={{ flex: 2 }} disabled={done === 0 || busy || failed} onClick={() => navigate('/add/confirm')}>
            Continue<Icon name="arrow-right" weight="bold" />
          </Button>
        </>
      }
    >
      <div className="page stack">
        <input ref={pick} type="file" hidden multiple accept={isPdf ? 'application/pdf' : 'image/*'} onChange={onPicked} />
        <input ref={cam} type="file" hidden accept="image/*" capture="environment" onChange={onPicked} />
        <div className="cluster">
          {isPdf ? (
            <Button variant="primary" icon="file-pdf" onClick={() => pick.current?.click()}>{files.length ? 'Add another PDF' : 'Choose PDF'}</Button>
          ) : (
            <>
              <Button variant="primary" icon="camera" onClick={() => cam.current?.click()}>Take photo</Button>
              <Button icon="image" onClick={() => pick.current?.click()}>From gallery</Button>
            </>
          )}
        </div>
        <p className="help">{isPdf ? 'PDF files up to 8 MB.' : 'You can add several photos. Large photos are made smaller automatically.'}</p>

        {files.length === 0 ? (
          <div className="add-dropempty">
            <Icon name={isPdf ? 'file-pdf' : 'camera'} />
            <span>Nothing added yet. Add at least one {isPdf ? 'PDF' : 'photo'} to continue.</span>
          </div>
        ) : (
          <div className="list" aria-label="Files">
            {files.map((f, i) => {
              const url = previewUrl(f.key);
              return (
                <div key={f.key} className="row add-file">
                  <div className="add-thumb">
                    {url ? <img src={url} alt="" /> : <Icon name={f.mime === 'application/pdf' ? 'file-pdf' : 'image'} />}
                  </div>
                  <div className="grow">
                    <div className="t truncate">{f.name}</div>
                    {f.status === 'uploading' ? (
                      <div className="add-prog" role="progressbar" aria-valuenow={f.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Uploading ${f.name}`}><i style={{ width: `${f.pct}%` }} /></div>
                    ) : f.status === 'error' ? (
                      <div className="error-text" role="alert">{f.error}</div>
                    ) : (
                      <div className="s">{f.size ? size(f.size) + ' · ' : ''}Uploaded</div>
                    )}
                  </div>
                  <div className="add-fileact">
                    {f.status === 'error' ? <IconButton plain icon="arrow-clockwise" label="Try again" onClick={() => retryFile(f.key)} /> : null}
                    {files.length > 1 ? (
                      <>
                        <IconButton plain icon="arrow-up" label="Move up" disabled={i === 0} onClick={() => dispatch({ type: 'moveFile', key: f.key, dir: -1 })} />
                        <IconButton plain icon="arrow-down" label="Move down" disabled={i === files.length - 1} onClick={() => dispatch({ type: 'moveFile', key: f.key, dir: 1 })} />
                      </>
                    ) : null}
                    <IconButton plain icon="trash" label={`Remove ${f.name}`} onClick={() => dispatch({ type: 'removeFile', key: f.key })} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {failed ? <div className="error-text" role="alert">Remove or retry the files that did not upload to continue.</div> : null}
      </div>
    </Frame>
  );
}
