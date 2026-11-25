import type {ComponentProps} from 'react';
import {CitizenMuiScope} from '../../design-system/mui';
import {citizenMuiDesktopTableSlots,MuiReadOnlyLedgerDialog} from '../../design-system/mui-record-adapters';
import {EventBasedTaxLedger} from './EventBasedTaxLedger';
export function MuiEventBasedTaxLedger(props:ComponentProps<typeof EventBasedTaxLedger>){
 return <CitizenMuiScope><EventBasedTaxLedger {...props} desktopSlots={citizenMuiDesktopTableSlots}
   ReadOnlyDialog={MuiReadOnlyLedgerDialog}/></CitizenMuiScope>;
}
