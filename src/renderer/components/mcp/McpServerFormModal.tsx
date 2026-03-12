import React, { useEffect, useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/solid';
import { i18nService } from '../../services/i18n';
import { McpServerConfig, McpServerFormData, McpRegistryEntry } from '../../types/mcp';

interface McpServerFormModalProps {
  isOpen: boolean;
  server?: McpServerConfig | null;
  registryEntry?: McpRegistryEntry | null;
  existingNames: string[];
  onClose: () => void;
  onSave: (data: McpServerFormData) => void;
}

const McpServerFormModal: React.FC<McpServerFormModalProps> = ({
  isOpen,
  server,
  registryEntry,
  existingNames,
  onClose,
  onSave,
}) => {
  const isEdit = !!server;
  const isRegistry = !!registryEntry && !isEdit;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [transportType, setTransportType] = useState<'stdio' | 'sse' | 'http'>('stdio');
  const [command, setCommand] = useState('');
  const [argsText, setArgsText] = useState('');
  const [envRows, setEnvRows] = useState<{ key: string; value: string; required?: boolean }[]>([]);
  const [url, setUrl] = useState('');
  const [headerRows, setHeaderRows] = useState<{ key: string; value: string }[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (server) {
      setName(server.name);
      setDescription(server.description);
      setTransportType(server.transportType);
      setCommand(server.command || '');
      setArgsText((server.args || []).join('\n'));
      setEnvRows(server.env ? Object.entries(server.env).map(([key, value]) => ({ key, value })) : []);
      setUrl(server.url || '');
      setHeaderRows(server.headers ? Object.entries(server.headers).map(([key, value]) => ({ key, value })) : []);
    } else if (registryEntry) {
      setName(registryEntry.name);
      const registryDescription =
        (i18nService.getLanguage() === 'zh' ? registryEntry.description_zh : registryEntry.description_en)
        || (registryEntry.descriptionKey ? i18nService.t(registryEntry.descriptionKey) : '');
      setDescription(registryDescription);
      setTransportType(registryEntry.transportType);
      setCommand(registryEntry.command);
      const allArgs = [...registryEntry.defaultArgs];
      if (registryEntry.argPlaceholders) {
        allArgs.push(...registryEntry.argPlaceholders);
      }
      setArgsText(allArgs.join('\n'));
      const envEntries: { key: string; value: string; required?: boolean }[] = [];
      if (registryEntry.requiredEnvKeys) {
        for (const key of registryEntry.requiredEnvKeys) {
          envEntries.push({ key, value: '', required: true });
        }
      }
      if (registryEntry.optionalEnvKeys) {
        for (const key of registryEntry.optionalEnvKeys) {
          envEntries.push({ key, value: '', required: false });
        }
      }
      setEnvRows(envEntries);
      setUrl('');
      setHeaderRows([]);
    } else {
      setName('');
      setDescription('');
      setTransportType('stdio');
      setCommand('');
      setArgsText('');
      setEnvRows([]);
      setUrl('');
      setHeaderRows([]);
    }
    setError('');
  }, [isOpen, server, registryEntry]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(i18nService.t('mcpNameRequired'));
      return;
    }

    const otherNames = existingNames.filter((existingName) => !isEdit || existingName !== server?.name);
    if (otherNames.includes(trimmedName)) {
      setError(i18nService.t('mcpNameExists'));
      return;
    }

    if (transportType === 'stdio' && !command.trim()) {
      setError(i18nService.t('mcpCommandRequired'));
      return;
    }

    if ((transportType === 'sse' || transportType === 'http') && !url.trim()) {
      setError(i18nService.t('mcpUrlRequired'));
      return;
    }

    const args = argsText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const env: Record<string, string> = {};
    for (const row of envRows) {
      const key = row.key.trim();
      if (key) env[key] = row.value;
    }

    const headers: Record<string, string> = {};
    for (const row of headerRows) {
      const key = row.key.trim();
      if (key) headers[key] = row.value;
    }

    const data: McpServerFormData = {
      name: trimmedName,
      description: description.trim(),
      transportType,
    };

    if (transportType === 'stdio') {
      data.command = command.trim();
      if (args.length > 0) data.args = args;
      if (Object.keys(env).length > 0) data.env = env;
    } else {
      data.url = url.trim();
      if (Object.keys(headers).length > 0) data.headers = headers;
    }

    if (isRegistry && registryEntry) {
      data.isBuiltIn = true;
      data.registryId = registryEntry.id;
    }

    onSave(data);
  };

  const handleAddEnvRow = () => {
    setEnvRows([...envRows, { key: '', value: '' }]);
  };

  const handleRemoveEnvRow = (index: number) => {
    setEnvRows(envRows.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleUpdateEnvRow = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...envRows];
    updated[index] = { ...updated[index], [field]: value };
    setEnvRows(updated);
  };

  const handleAddHeaderRow = () => {
    setHeaderRows([...headerRows, { key: '', value: '' }]);
  };

  const handleRemoveHeaderRow = (index: number) => {
    setHeaderRows(headerRows.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleUpdateHeaderRow = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...headerRows];
    updated[index] = { ...updated[index], [field]: value };
    setHeaderRows(updated);
  };

  if (!isOpen) return null;

  const inputClass = 'w-full px-3 py-2 text-sm rounded-xl dark:bg-dark-bg bg-page dark:text-dark-text text-text-primary dark:placeholder-dark-text-secondary placeholder-text-secondary border dark:border-dark-border border-border focus:outline-none focus:ring-2 focus:ring-primary';
  const readOnlyInputClass = `${inputClass} opacity-60 cursor-not-allowed`;
  const labelClass = 'text-xs font-semibold tracking-wide dark:text-dark-text-secondary text-text-secondary';
  const kvInputClass = 'flex-1 px-3 py-2 text-sm rounded-lg dark:bg-dark-bg bg-page dark:text-dark-text text-text-primary border dark:border-dark-border border-border focus:outline-none focus:ring-2 focus:ring-primary';
  const sectionTitleClass = 'text-sm font-medium dark:text-dark-text text-text-primary';

  const modalTitle = isEdit
    ? i18nService.t('editMcpServer')
    : isRegistry
      ? `${i18nService.t('mcpInstall')} ${registryEntry!.name}`
      : i18nService.t('addMcpServer');

  const saveText = isRegistry && !isEdit
    ? i18nService.t('mcpInstall')
    : i18nService.t('saveMcpServer');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop"
      onClick={onClose}
    >
      <div
        className="modal-content w-full max-w-xl mx-4 dark:bg-dark-surface bg-surface rounded-2xl shadow-modal overflow-hidden border dark:border-dark-border border-border"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b dark:border-dark-border border-border">
          <div>
            <div className="text-base font-semibold dark:text-dark-text text-text-primary">
              {modalTitle}
            </div>
            {isRegistry && (
              <div className="mt-1 text-xs dark:text-dark-text-secondary text-text-secondary">
                {i18nService.t('mcpRequiredConfig')}
                {envRows.some((row) => row.required) ? `: ${envRows.filter((row) => row.required).length}` : ''}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg dark:text-dark-text-secondary text-text-secondary dark:hover:bg-dark-surface-hover hover:bg-surface-hover transition-colors"
            aria-label={i18nService.t('cancel')}
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-[68vh] overflow-y-auto px-5 py-4 space-y-4">
          <div className="space-y-4">
            <div className={sectionTitleClass}>{i18nService.t('mcpServerName')}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className={labelClass}>{i18nService.t('mcpServerName')}</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={i18nService.t('mcpServerNamePlaceholder')}
                  className={isRegistry ? readOnlyInputClass : inputClass}
                  readOnly={isRegistry}
                  autoFocus={!isRegistry}
                />
              </div>

              <div className="space-y-1.5">
                <label className={labelClass}>{i18nService.t('mcpTransportType')}</label>
                <select
                  value={transportType}
                  onChange={(e) => setTransportType(e.target.value as 'stdio' | 'sse' | 'http')}
                  className={isRegistry ? readOnlyInputClass : inputClass}
                  disabled={isRegistry}
                >
                  <option value="stdio">{i18nService.t('mcpTransportStdio')}</option>
                  <option value="sse">{i18nService.t('mcpTransportSse')}</option>
                  <option value="http">{i18nService.t('mcpTransportHttp')}</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className={labelClass}>{i18nService.t('mcpServerDescription')}</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={i18nService.t('mcpServerDescriptionPlaceholder')}
                className={inputClass}
              />
            </div>
          </div>

          {transportType === 'stdio' && (
            <div className="space-y-3 border-t dark:border-dark-border border-border pt-4">
              <div className={sectionTitleClass}>{i18nService.t('mcpCommand')}</div>

              <div className="space-y-1.5">
                <label className={labelClass}>{i18nService.t('mcpCommand')}</label>
                <input
                  type="text"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder={i18nService.t('mcpCommandPlaceholder')}
                  className={isRegistry ? readOnlyInputClass : inputClass}
                  readOnly={isRegistry}
                />
              </div>

              <div className="space-y-1.5">
                <label className={labelClass}>{i18nService.t('mcpArgs')}</label>
                <textarea
                  value={argsText}
                  onChange={(e) => setArgsText(e.target.value)}
                  placeholder={i18nService.t('mcpArgsPlaceholder')}
                  rows={3}
                  className={`${inputClass} resize-none`}
                  autoFocus={isRegistry}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className={labelClass}>
                    {i18nService.t('mcpEnvVars')}
                    {isRegistry && envRows.some((row) => row.required) && (
                      <span className="ml-2 text-[10px] font-normal text-red-400">
                        * {i18nService.t('mcpRequiredConfig')}
                      </span>
                    )}
                  </label>
                  <button
                    type="button"
                    onClick={handleAddEnvRow}
                    className="text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    + {i18nService.t('addKeyValue')}
                  </button>
                </div>

                <div className="space-y-2">
                  {envRows.map((row, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={row.key}
                        onChange={(e) => handleUpdateEnvRow(index, 'key', e.target.value)}
                        placeholder={i18nService.t('mcpHeaderKey')}
                        className={row.required ? `${kvInputClass} opacity-60 cursor-not-allowed` : kvInputClass}
                        readOnly={!!row.required}
                      />
                      <input
                        type="text"
                        value={row.value}
                        onChange={(e) => handleUpdateEnvRow(index, 'value', e.target.value)}
                        placeholder={row.required ? `${row.key} *` : i18nService.t('mcpHeaderValue')}
                        className={kvInputClass}
                        autoFocus={isRegistry && index === 0 && !!row.required}
                      />
                      {!row.required ? (
                        <button
                          type="button"
                          onClick={() => handleRemoveEnvRow(index)}
                          className="p-1 text-text-secondary dark:text-dark-text-secondary hover:text-red-500 dark:hover:text-red-400 transition-colors flex-shrink-0"
                        >
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="text-red-400 text-xs flex-shrink-0 w-4 text-center">*</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {(transportType === 'sse' || transportType === 'http') && (
            <div className="space-y-3 border-t dark:border-dark-border border-border pt-4">
              <div className={sectionTitleClass}>{i18nService.t('mcpUrl')}</div>

              <div className="space-y-1.5">
                <label className={labelClass}>{i18nService.t('mcpUrl')}</label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder={i18nService.t('mcpUrlPlaceholder')}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className={labelClass}>{i18nService.t('mcpHeaders')}</label>
                  <button
                    type="button"
                    onClick={handleAddHeaderRow}
                    className="text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    + {i18nService.t('addKeyValue')}
                  </button>
                </div>

                <div className="space-y-2">
                  {headerRows.map((row, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={row.key}
                        onChange={(e) => handleUpdateHeaderRow(index, 'key', e.target.value)}
                        placeholder={i18nService.t('mcpHeaderKey')}
                        className={kvInputClass}
                      />
                      <input
                        type="text"
                        value={row.value}
                        onChange={(e) => handleUpdateHeaderRow(index, 'value', e.target.value)}
                        placeholder={i18nService.t('mcpHeaderValue')}
                        className={kvInputClass}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveHeaderRow(index)}
                        className="p-1 text-text-secondary dark:text-dark-text-secondary hover:text-red-500 dark:hover:text-red-400 transition-colors flex-shrink-0"
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="text-xs text-red-500">{error}</div>
          )}
        </div>

        <div className="px-5 py-3.5 flex items-center justify-end gap-2 border-t dark:border-dark-border border-border">
          <button
            type="button"
            onClick={onClose}
            className="app-secondary-btn px-4 py-2 text-sm"
          >
            {i18nService.t('cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="app-primary-btn px-4 py-2 text-sm"
          >
            {saveText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default McpServerFormModal;

