import {describe,it,expect} from 'vitest'
import {citiesForState,indianStates} from './india-locations'

describe('India location master',()=>{
  it('contains every major Indian state and union territory',()=>{
    expect(indianStates).toContain('Delhi')
    expect(indianStates).toContain('Haryana')
    expect(indianStates).toContain('Uttar Pradesh')
    expect(indianStates).toHaveLength(36)
  })

  it('filters cities by selected state',()=>{
    expect(citiesForState('Delhi')).toContain('New Delhi')
    expect(citiesForState('Uttar Pradesh')).toContain('Noida')
    expect(citiesForState('Haryana')).toContain('Gurugram')
  })
})
