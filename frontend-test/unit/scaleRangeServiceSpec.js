'use strict';
define(['angular', 'angular-mocks', 'mcda/subProblem/scaleRangeService'], function() {

  // - the lower bound must be lower than the lower end of the observed range
  // - the upper bound should be higher than the upper end of the observed range
  // - the values should be "nice" (have no more than two significant digits, preferably only one)

  // - the lower bound must be greater than or equal to the theoretical lower bound
  // - the upper bound must be smaller than or equal to the theoretical upper bound


  describe('The scaleRange service', function() {

    beforeEach(module('elicit.util'));
    beforeEach(module('elicit.subProblem'));

    describe('calculateScales', function() {
      it('on unbounded scales, bounds should lie outside the observed range', inject(function(ScaleRangeService) {
        var criterionScale = [null, null];
        var from = -16.123;
        var to = -12.123;
        var criterionRange = [from, to];

        var result = ScaleRangeService.calculateScales(criterionScale, from, to, criterionRange);
        expect(result.sliderOptions.floor).toEqual(-20);
        expect(result.sliderOptions.ceil).toEqual(-10);
        expect(result.sliderOptions.restrictedRange.from).toEqual(-16.123);
        expect(result.sliderOptions.restrictedRange.to).toEqual(-12.123);
      }));
      it('should work for fractional/small ranges', inject(function(ScaleRangeService) {
        var criterionScale = [0, 1];
        var from = 0.17791;
        var to = 0.25323;
        var criterionRange = [from, to];

        var result = ScaleRangeService.calculateScales(criterionScale, from, to, criterionRange);
        expect(result.sliderOptions.floor).toEqual(0.1);
        expect(result.sliderOptions.ceil).toEqual(0.30000000000000004);
        
      }));
    });

    describe('niceFrom', function() {
      it('should', inject(function(ScaleRangeService) {
        expect(ScaleRangeService.niceFrom(150)).toEqual(100);
        expect(ScaleRangeService.niceFrom(15)).toEqual(10);
        expect(ScaleRangeService.niceFrom(1.5)).toEqual(1);
        expect(ScaleRangeService.niceFrom(0.15)).toEqual(0.1);
        expect(ScaleRangeService.niceFrom(0.015)).toEqual(0.01);

        expect(ScaleRangeService.niceFrom(-150)).toEqual(-200);
        expect(ScaleRangeService.niceFrom(-15)).toEqual(-20);
        expect(ScaleRangeService.niceFrom(-1.5)).toEqual(-2);
        expect(ScaleRangeService.niceFrom(-0.15)).toEqual(-0.2);
        expect(ScaleRangeService.niceFrom(-0.015)).toEqual(-0.02);

        expect(ScaleRangeService.niceFrom(0)).toEqual(0);

      }));
    });
    describe('niceTo', function() {
      it('should', inject(function(ScaleRangeService) {
        expect(ScaleRangeService.niceTo(150)).toEqual(200);
        expect(ScaleRangeService.niceTo(15)).toEqual(20);
        expect(ScaleRangeService.niceTo(1.5)).toEqual(2);
        expect(ScaleRangeService.niceTo(0.15)).toEqual(0.2);
        expect(ScaleRangeService.niceTo(0.015)).toEqual(0.02);

        expect(ScaleRangeService.niceTo(-150)).toEqual(-100);
        expect(ScaleRangeService.niceTo(-15)).toEqual(-10);
        expect(ScaleRangeService.niceTo(-1.5)).toEqual(-1);
        expect(ScaleRangeService.niceTo(-0.15)).toEqual(-0.1);
        expect(ScaleRangeService.niceTo(-0.015)).toEqual(-0.01);

        expect(ScaleRangeService.niceTo(0)).toEqual(0);
      }));
    });
    describe('createRanges', function() {
      it('should create ranges for each scales choices', inject(function(ScaleRangeService) {
        var choices = {
          headacheId: {
            from: 10,
            to: 20
          },
          nauseaId: {
            from: 30,
            to: 40
          }
        };

        var ranges = ScaleRangeService.createRanges(choices);

        var expectedRanges = {
          headacheId: {
            pvf: {
              range: [10, 20]
            }
          },
          nauseaId: {
            pvf: {
              range: [30, 40]
            }
          }
        };
        expect(ranges).toEqual(expectedRanges);
      }));
    });
    describe('getScaleStateAndChoices', function() {
      it('should return the scale state and the choices', inject(function(ScaleRangeService) {
        var observedScales = {
          headacheId: {
            alt1: {
              '2.5%': 10,
              '50%': 20,
              '97.5%': 30
            }
          },
          nauseaId: {
            alt1: {
              '2.5%': 15,
              '50%': 25,
              '97.5%': 35
            }
          }
        };
        var criteria = {
          headacheId: {
            pvf: {
              range: [0, 40]
            }
          },
          nauseaId: {
            pvf: {
              range: [10, 40]
            }
          }
        };
        var result = ScaleRangeService.getScaleStateAndChoices(observedScales, criteria);
        var expectedResult = {
          choices: {
            headacheId: {
              from: 0,
              to: 40
            },
            nauseaId: {
              from: 10,
              to: 40
            }
          },
          scaleState: {
            headacheId: {
              sliderOptions: {
                restrictedRange: {
                  from: 10,
                  to: 30
                },
                floor: 0,
                ceil: 40,
                step: 0.4,
                precision: 50,
                noSwitching: true
              }
            },
            nauseaId: {
              sliderOptions: {
                restrictedRange: {
                  from: 15,
                  to: 35
                },
                floor: 10,
                ceil: 40,
                step: 0.3,
                precision: 50,
                noSwitching: true
              }
            }
          }
        };
        expect(typeof result.scaleState.headacheId.increaseFrom).toBe('function');
        expect(typeof result.scaleState.headacheId.increaseTo).toBe('function');
        expect(result.scaleState.headacheId.sliderOptions.restrictedRange).toEqual(expectedResult.scaleState.headacheId.sliderOptions.restrictedRange);
        expect(result.scaleState.headacheId.sliderOptions.floor).toEqual(expectedResult.scaleState.headacheId.sliderOptions.floor);
        expect(result.scaleState.headacheId.sliderOptions.ceil).toEqual(expectedResult.scaleState.headacheId.sliderOptions.ceil);
        expect(result.scaleState.headacheId.sliderOptions.step).toEqual(expectedResult.scaleState.headacheId.sliderOptions.step);
        expect(typeof result.scaleState.nauseaId.increaseFrom).toBe('function');
        expect(typeof result.scaleState.nauseaId.increaseTo).toBe('function');
        expect(result.scaleState.nauseaId.sliderOptions.restrictedRange).toEqual(expectedResult.scaleState.nauseaId.sliderOptions.restrictedRange);
        expect(result.scaleState.nauseaId.sliderOptions.floor).toEqual(expectedResult.scaleState.nauseaId.sliderOptions.floor);
        expect(result.scaleState.nauseaId.sliderOptions.ceil).toEqual(expectedResult.scaleState.nauseaId.sliderOptions.ceil);
        expect(result.scaleState.nauseaId.sliderOptions.step).toEqual(expectedResult.scaleState.nauseaId.sliderOptions.step);
        expect(result.choices).toEqual(expectedResult.choices);
      }));
    });
  });
});