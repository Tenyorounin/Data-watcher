module.exports = function template(dataScript) {
  return `
<!doctype html>
<html>
<head>
  <title>Listings</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>

<select id="hideGasFilter">
  <option value="yes" selected>Hide gas</option>
  <option value="no">Show all</option>
</select>

<div id="results"></div>

<script>
${dataScript}
</script>

<script src="page_logic.js"></script>

</body>
</html>
`;
};
