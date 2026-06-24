// SPDX-License-Identifier: MIT

import { area } from './base.mjs'
import { mutationAreas } from './areas.mjs'

const { mutate, reportDir, breakAt } = mutationAreas.schema
export default area({ mutate, reportDir, breakAt })
