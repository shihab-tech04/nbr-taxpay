import type {ComponentPropsWithoutRef} from 'react';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import type {TaxPayDesktopTableSlots} from '../components/ui/TaxPayDataTable';
import {CitizenMuiScope} from './mui';

/** Material UI desktop table primitives; existing CSS and mobile cards retain their approved contract. */
export const citizenMuiDesktopTableSlots:TaxPayDesktopTableSlots={
  Table:({className,...props}:ComponentPropsWithoutRef<'table'>)=>
    <CitizenMuiScope><Table {...props} className={className} data-unified-table="true" data-mui-record-table="true"
      sx={{display:'none','@media (min-width:768px)':{display:'table'},borderCollapse:'separate',borderSpacing:0,font:'inherit'}}/></CitizenMuiScope>,
  Head:props=><TableHead {...props}/>,
  Body:props=><TableBody {...props}/>,
  Row:props=><TableRow {...props}/>,
  HeaderCell:({align,...props})=><TableCell {...props} align={align==="char"?undefined:align} component="th" variant="head" sx={{font:'inherit',color:'inherit'}}/>,
  Cell:({align,...props})=><TableCell {...props} align={align==="char"?undefined:align} component="td" variant="body" sx={{font:'inherit',color:'inherit'}}/>,
};
