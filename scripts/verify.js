#!/usr/bin/env node
// Verification: checks architecture invariants without fake 24/7
import { createProvider, listProviders, list247CapableProviders, getHonestAvailabilityMessage } from "../packages/execution-provider/src/factory.ts";
