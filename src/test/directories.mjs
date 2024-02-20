
import Test from './test.mjs'

function checkValidity(path) {
    return /^(\/([^/]+\/)*)(.*)$/.test(path)
}



(() => {

    let test = new Test('Path validation', checkValidity);
    test.test(true, '/').log();
    test.test(false, 'test/').log();
    test.test(false, '///').log();

})()