import { ipcMain } from 'electron';
import type { AppBootstrapState } from '../bootstrap/initializeApp';
import type { SqliteDatabaseLike } from '../db/connection';
import { createAppHealthChannel } from './appHealth';
import { createCatalogDeleteProductChannel } from './catalogDeleteProduct';
import { createCatalogListChannel } from './catalogList';
import { createCatalogProductDetailChannel } from './catalogProductDetail';
import { createCatalogSearchChannel } from './catalogSearch';
import { createCatalogUpdateProductChannel } from './catalogUpdateProduct';
import { createConsignmentsConfirmBatchChannel } from './consignmentsConfirmBatch';
import { createConsignmentsExportBatchExcelChannel } from './consignmentsExportBatchExcel';
import { createConsignmentsGetDetailChannel } from './consignmentsGetDetail';
import { createConsignmentsListHistoryChannel } from './consignmentsListHistory';
import { createConsignmentsListPendingItemsChannel } from './consignmentsListPendingItems';
import { registerValidatedIpc, type IpcMainLike } from './registerValidatedIpc';
import { createSalesCancelChannel } from './salesCancel';
import { createSalesAssignCustomerForPaymentRecoveryChannel } from './salesAssignCustomerForPaymentRecovery';
import { createSalesCancelPaymentChannel } from './salesCancelPayment';
import { createSalesConfirmDraftChannel } from './salesConfirmDraft';
import { createSalesGetDetailChannel } from './salesGetDetail';
import { createSalesListHistoryChannel } from './salesListHistory';
import { createSalesRegisterPaymentChannel } from './salesRegisterPayment';
import { createSaveStockIntakeChannel } from './saveStockIntake';
import type { ConsignmentExcelShellAdapters } from '../reporting/exportConsignmentBatchExcel';

export interface RegisterIpcOptions {
  bootstrapState: AppBootstrapState;
  database: SqliteDatabaseLike;
  getAppVersion?: () => string;
  ipcMainLike?: IpcMainLike;
  showConsignmentExportSaveDialog?: ConsignmentExcelShellAdapters['showSaveDialog'];
  writeConsignmentExportFile?: ConsignmentExcelShellAdapters['writeFile'];
}

export function registerIpc({
  bootstrapState,
  database,
  getAppVersion = () => '0.0.0',
  ipcMainLike = ipcMain,
  showConsignmentExportSaveDialog,
  writeConsignmentExportFile
}: RegisterIpcOptions): void {
  registerValidatedIpc({
    ipcMainLike,
    definition: createAppHealthChannel({
      getAppVersion,
      bootstrapState
    })
  });

  registerValidatedIpc({
    ipcMainLike,
    definition: createCatalogSearchChannel({ database })
  });

  registerValidatedIpc({
    ipcMainLike,
    definition: createCatalogListChannel({ database })
  });

  registerValidatedIpc({
    ipcMainLike,
    definition: createCatalogProductDetailChannel({ database })
  });

  registerValidatedIpc({
    ipcMainLike,
    definition: createCatalogUpdateProductChannel({ database })
  });

  registerValidatedIpc({
    ipcMainLike,
    definition: createCatalogDeleteProductChannel({ database })
  });

  registerValidatedIpc({
    ipcMainLike,
    definition: createSaveStockIntakeChannel({ database })
  });

  registerValidatedIpc({
    ipcMainLike,
    definition: createSalesListHistoryChannel({ database })
  });

  registerValidatedIpc({
    ipcMainLike,
    definition: createSalesGetDetailChannel({ database })
  });

  registerValidatedIpc({
    ipcMainLike,
    definition: createSalesConfirmDraftChannel({ database })
  });

  registerValidatedIpc({
    ipcMainLike,
    definition: createSalesRegisterPaymentChannel({ database })
  });

  registerValidatedIpc({
    ipcMainLike,
    definition: createSalesCancelPaymentChannel({ database })
  });

  registerValidatedIpc({
    ipcMainLike,
    definition: createSalesAssignCustomerForPaymentRecoveryChannel({ database })
  });

  registerValidatedIpc({
    ipcMainLike,
    definition: createSalesCancelChannel({ database })
  });

  registerValidatedIpc({
    ipcMainLike,
    definition: createConsignmentsListPendingItemsChannel({ database })
  });

  registerValidatedIpc({
    ipcMainLike,
    definition: createConsignmentsConfirmBatchChannel({ database })
  });

  registerValidatedIpc({
    ipcMainLike,
    definition: createConsignmentsListHistoryChannel({ database })
  });

  registerValidatedIpc({
    ipcMainLike,
    definition: createConsignmentsGetDetailChannel({ database })
  });

  registerValidatedIpc({
    ipcMainLike,
    definition: createConsignmentsExportBatchExcelChannel({
      database,
      showSaveDialog: showConsignmentExportSaveDialog,
      writeFile: writeConsignmentExportFile
    })
  });
}
