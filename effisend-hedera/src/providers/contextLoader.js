import { Fragment, useCallback, useContext, useEffect } from "react";
import ContextModule from "./contextModule";
import { getAsyncStorageValue } from "../core/utils";

export default function ContextLoader() {
  const context = useContext(ContextModule);
  const checkStarter = useCallback(async () => {
    const accountId = await getAsyncStorageValue("accountId");
    console.log(accountId);
    if (accountId === null) {
      context.setValue({
        starter: true,
      });
    } else {
      const balances = await getAsyncStorageValue("balances");
      const usdConversion = await getAsyncStorageValue("usdConversion");
      context.setValue({
        accountId: accountId ?? context.value.accountId,
        balances: balances ?? context.value.balances,
        usdConversion: usdConversion ?? context.value.usdConversion,
        starter: true,
      });
    }
  }, [context]);

  useEffect(() => {
    checkStarter();
  }, []);

  return <Fragment />;
}
