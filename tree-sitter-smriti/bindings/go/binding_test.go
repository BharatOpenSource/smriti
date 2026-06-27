package tree_sitter_smriti_test

import (
	"testing"

	tree_sitter "github.com/smacker/go-tree-sitter"
	"github.com/tree-sitter/tree-sitter-smriti"
)

func TestCanLoadGrammar(t *testing.T) {
	language := tree_sitter.NewLanguage(tree_sitter_smriti.Language())
	if language == nil {
		t.Errorf("Error loading Smriti grammar")
	}
}
