import { useState } from 'react';
import { ACTIONS, ADMIN_ROLES, MENUS, getConfig, updateConfig } from '../../config';
import type { AccessSettings, RoleAccess } from '../../config';
import { Button, Callout, Card, CardHeader, Checkbox, HeadRow, Select, Table, TableContainer, Td, Tr } from '../../components/ui';
import { NoticeBox, useAction, useConfigRevision } from './shared';

const SCOPES: RoleAccess['scope'][] = ['All business units', 'Own business unit', 'Assigned suppliers'];

// I. Menu, action and organization-level permissions per role.
export default function AccessSettings() {
  useConfigRevision();
  const { notice, run } = useAction();
  const [access, setAccess] = useState<AccessSettings>(() => getConfig('access'));
  const patch = (role: string, change: Partial<RoleAccess>) => setAccess(current => ({ ...current, [role]: { ...current[role], ...change } }));
  const toggle = (role: string, group: 'menus' | 'actions', key: string, value: boolean) => patch(role, { [group]: { ...access[role][group], [key]: value } } as Partial<RoleAccess>);
  const save = () => run(() => { updateConfig('access', draft => { Object.assign(draft, access); }, 'Role permissions updated'); }, 'Permissions saved');

  return (
    <div className="max-w-6xl space-y-4">
      <NoticeBox notice={notice} />
      <Callout tone="info" compact>These settings extend the existing role-based data visibility. Admin always keeps Administration and Configure access.</Callout>
      <Card className="overflow-hidden">
        <CardHeader title="Menu permissions" description="Which modules each role can open" />
        <TableContainer>
          <Table minWidth={1100}>
            <HeadRow columns={['Role', ...MENUS]} />
            <tbody>{ADMIN_ROLES.map(role => (
              <Tr key={role}><Td className="font-medium text-ink">{role}</Td>{MENUS.map(menu => <Td key={menu} className="text-center"><Checkbox aria-label={`${role}: ${menu}`} checked={!!access[role].menus[menu]} disabled={role === 'Admin' && menu === 'Administration'} onChange={event => toggle(role, 'menus', menu, event.target.checked)} /></Td>)}</Tr>
            ))}</tbody>
          </Table>
        </TableContainer>
      </Card>
      <Card className="overflow-hidden">
        <CardHeader title="Action permissions and organization access" />
        <TableContainer>
          <Table minWidth={900}>
            <HeadRow columns={['Role', ...ACTIONS, 'Organization-level access']} />
            <tbody>{ADMIN_ROLES.map(role => (
              <Tr key={role}>
                <Td className="font-medium text-ink">{role}</Td>
                {ACTIONS.map(action => <Td key={action} className="text-center"><Checkbox aria-label={`${role}: ${action}`} checked={!!access[role].actions[action]} disabled={role === 'Admin' && action === 'Configure'} onChange={event => toggle(role, 'actions', action, event.target.checked)} /></Td>)}
                <Td><Select size="sm" aria-label={`${role} access scope`} value={access[role].scope} onChange={event => patch(role, { scope: event.target.value as RoleAccess['scope'] })}>{SCOPES.map(item => <option key={item}>{item}</option>)}</Select></Td>
              </Tr>
            ))}</tbody>
          </Table>
        </TableContainer>
        <div className="flex justify-end border-t border-line-subtle px-5 py-3"><Button variant="primary" onClick={save}>Save permissions</Button></div>
      </Card>
    </div>
  );
}
